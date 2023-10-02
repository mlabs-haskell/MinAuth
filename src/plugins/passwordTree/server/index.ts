import { Experimental, Field, JsonProof, MerkleTree, PrivateKey, AccountUpdate, Mina } from "o1js";
import ProvePasswordInTreeProgram, { PASSWORD_TREE_HEIGHT, PasswordTreeWitness } from "../common/passwordTreeProgram";
import { IMinAuthPlugin, IMinAuthPluginFactory } from '../../../library/plugin/pluginType';
import { RequestHandler } from "express";
import { z } from "zod";
import { TreeRootStorageContract } from "../common/treeRootStorageContract";
import fs from 'fs/promises'

const PasswordInTreeProofClass = Experimental.ZkProgram.Proof(ProvePasswordInTreeProgram);

abstract class TreeStorage {
  abstract getRoot(): Promise<Field>;
  abstract getWitness(uid: bigint): Promise<undefined | PasswordTreeWitness>;
  abstract getRole(uid: bigint): Promise<undefined | string>;
  abstract updateUser(uid: bigint, passwordHash: Field, role: string): Promise<void>;
  abstract hasUser(uid: bigint): Promise<boolean>;
}

class InMemoryStorage implements TreeStorage {
  roles: Map<bigint, string> = new Map();;
  merkleTree: MerkleTree = new MerkleTree(PASSWORD_TREE_HEIGHT);

  async getRoot() { return this.merkleTree.getRoot(); }

  async getWitness(uid: bigint) {
    if (!this.roles.has(uid)) return undefined;
    return new PasswordTreeWitness(this.merkleTree.getWitness(uid))
  }

  async getRole(uid: bigint) { return this.roles.get(uid); }

  async updateUser(uid: bigint, passwordHash: Field, role: string): Promise<void> {
    this.roles.set(uid, role);
    this.merkleTree.setLeaf(uid, passwordHash);
  }

  async hasUser(uid: bigint): Promise<boolean> {
    return this.roles.has(uid);
  }
}

class PersistentInMemoryStorage extends InMemoryStorage {
  readonly file: fs.FileHandle;

  async persist() {
    const emptyObj: Record<string, { passwordHash: string, role: string }> = {}
    const storageObj = Array.from(this.roles.entries())
      .reduce((prev, [uid, role]) => {
        const passwordHash =
          this.merkleTree.getNode(PASSWORD_TREE_HEIGHT, uid).toString();
        prev[uid.toString()] = { passwordHash, role };
        return prev;
      }, emptyObj);
    await this.file.write(JSON.stringify(storageObj), 0, 'utf-8');
  }

  private constructor(
    file: fs.FileHandle,
    roles: Map<bigint, string>,
    merkleTree: MerkleTree) {
    super();

    this.file = file;
    this.roles = roles;
    this.merkleTree = merkleTree;
  }

  static async initialize(path: string): Promise<PersistentInMemoryStorage> {
    const handle = await fs.open(path, 'r+');
    const content = await handle.readFile('utf-8');
    const storageObj: Record<string, { passwordHash: string, role: string }> =
      JSON.parse(content);

    const roles: Map<bigint, string> = new Map();
    const merkleTree: MerkleTree = new MerkleTree(PASSWORD_TREE_HEIGHT);

    Object
      .entries(storageObj)
      .forEach((
        [uidStr, { passwordHash: passwordHashStr, role }]) => {
        const uid = BigInt(uidStr);
        const passwordHash = Field.from(passwordHashStr);
        roles.set(uid, role);
        merkleTree.setLeaf(uid, passwordHash);
      });

    return new PersistentInMemoryStorage(handle, roles, merkleTree);
  }

  async updateUser(uid: bigint, passwordHash: Field, role: string): Promise<void> {
    const prevRoot = this.merkleTree.getRoot();
    await super.updateUser(uid, passwordHash, role);
    const root = this.merkleTree.getRoot();
    if (prevRoot.equals(root).toBoolean()) return;
    await this.persist();
  }
}

class GenericMinaBlockchainStorage<T extends TreeStorage> implements TreeStorage {
  private underlyingStorage: T;
  private contract: TreeRootStorageContract
  private mkTx: (txFn: () => void) => Promise<void>

  constructor(
    storage: T,
    contract: TreeRootStorageContract,
    mkTx: (txFn: () => void) => Promise<void>) {
    this.underlyingStorage = storage;
    this.contract = contract;
    this.mkTx = mkTx;
  }

  async updateTreeRootOnChainIfNecessary() {
    const onChain = await this.contract.treeRoot.fetch();
    const offChain = await this.underlyingStorage.getRoot();

    if (!onChain)
      throw "tree root storage contract not deployed";

    if (onChain.equals(offChain).toBoolean())
      return;

    await this.mkTx(() => this.contract.treeRoot.set(offChain));
  }

  async getRoot() { return this.underlyingStorage.getRoot(); }

  async getWitness(uid: bigint) { return this.underlyingStorage.getWitness(uid); }

  async getRole(uid: bigint) { return this.underlyingStorage.getRole(uid); }

  async updateUser(uid: bigint, passwordHash: Field, role: string): Promise<void> {
    await this.underlyingStorage.updateUser(uid, passwordHash, role);
    await this.updateTreeRootOnChainIfNecessary();
  }

  async hasUser(uid: bigint): Promise<boolean> {
    return this.underlyingStorage.hasUser(uid);
  }
}

async function initializeGenericMinaBlockchainStorage<T extends TreeStorage>(
  storage: T,
  contractPrivateKey: PrivateKey,
  feePayerPrivateKey: PrivateKey
): Promise<GenericMinaBlockchainStorage<T>> {
  await TreeRootStorageContract.compile();
  const contract = new TreeRootStorageContract(contractPrivateKey.toPublicKey());
  const feePayerPublicKey = feePayerPrivateKey.toPublicKey();

  const mkTx = async (txFn: () => void): Promise<void> => {
    const txn = await Mina.transaction(feePayerPublicKey, txFn);
    await txn.prove();
    await txn.sign([feePayerPrivateKey, contractPrivateKey]).send();
  };

  const blockchainStorage = new GenericMinaBlockchainStorage(storage, contract, mkTx);

  if (contract.account.isNew.get()) {
    const treeRoot = await storage.getRoot();
    await mkTx(() => {
      AccountUpdate.fundNewAccount(feePayerPublicKey);
      contract.treeRoot.set(treeRoot);
      contract.deploy();
    });
  } else {
    await blockchainStorage.updateTreeRootOnChainIfNecessary();
  }

  return blockchainStorage;
}

class MinaBlockchainStorage
  extends GenericMinaBlockchainStorage<PersistentInMemoryStorage>{
  static async initialize(
    path: string,
    contractPrivateKey: PrivateKey,
    feePayerPrivateKey: PrivateKey) {
    const storage = await PersistentInMemoryStorage.initialize(path);
    return initializeGenericMinaBlockchainStorage(
      storage,
      contractPrivateKey,
      feePayerPrivateKey);
  }
}

const PoseidonHashSchema = z.bigint();

const publicInputArgsSchema = z.array(PoseidonHashSchema);

export class MemberSetPlugin implements IMinAuthPlugin<z.infer<typeof publicInputArgsSchema>, string>{
  readonly verificationKey: string;
  private readonly storage: TreeStorage

  customRoutes: Record<string, RequestHandler> = {
      // NOTE: witnesses are not public inputs now
    // "/witness/:uid": async (req, resp) => {
    //   if (req.method != 'GET') {
    //     resp.status(400);
    //     return;
    //   }

    //   const uid = BigInt(req.params['uid']);
    //   const witness = await this.storage.getWitness(uid);

    //   if (!witness) {
    //     resp
    //       .status(400)
    //       .json({ error: "requested user doesn't exist" });
    //     return;
    //   }

    //   resp.status(200).json(witness);
    // },

      // TODO:
      // input: array of merkle roots (eg. [root1, root2, root3])
      // output: object of the form { root1: tree1, root2: tree2, root3: tree3 }
    "/roots": async (req, resp) => {
      if (req.method != 'GET') {
        resp.status(400);
        return;
      }

      const root = await this.storage.getRoot();
      return resp.status(200).json(root);
    },
    "/setPassword/:uid": async (req, resp) => {
      const uid = BigInt(req.params['uid']);
      const { passwordHashStr }: { passwordHashStr: string } = req.body;
      const passwordHash = Field.from(passwordHashStr);
      if (!await this.storage.hasUser(uid))
        throw "user doesn't exist";
      const role = await this.storage.getRole(uid);
      this.storage.updateUser(uid, passwordHash, role!);
      resp.status(200);
    }
  };

  publicInputArgsSchema = publicInputArgsSchema;

    async verifyAndGetOutput(uid: z.infer<typeof publicInputArgsSchema>, jsonProof: JsonProof):
    Promise<string> {

        // build an array of merkle trees
    const proof = PasswordInTreeProofClass.fromJSON(jsonProof);
    const expectedWitness = await this.storage.getWitness(uid);
    const expectedRoot = await this.storage.getRoot();
    if (proof.publicInput.witness != expectedWitness ||
      proof.publicInput.root != expectedRoot) {
      throw 'public input invalid';
    }
    const role = await this.storage.getRole(uid);
    if (!role) { throw 'unknown public input'; }
    return role;
  };

  constructor(verificationKey: string, storage: MinaBlockchainStorage) {
    this.verificationKey = verificationKey;
    this.storage = storage;
  }

  static async initialize(configuration: {
    storageFile: string,
    contractPrivateKey: string,
    feePayerPrivateKey: string
  }): Promise<MemberSetPlugin> {
    const { verificationKey } = await ProvePasswordInTreeProgram.compile();
    const storage = await MinaBlockchainStorage
      .initialize(
        configuration.storageFile,
        PrivateKey.fromBase58(configuration.contractPrivateKey),
        PrivateKey.fromBase58(configuration.feePayerPrivateKey)
      )
    return new MemberSetPlugin(verificationKey, storage);
  }

  static readonly configurationSchema:
    z.ZodType<{
      storageFile: string,
      contractPrivateKey: string,
      feePayerPrivateKey: string
    }> =
    z.object({
      storageFile: z.string(),
      contractPrivateKey: z.string(),
      feePayerPrivateKey: z.string()
    })
}

MemberSetPlugin satisfies
  IMinAuthPluginFactory<
    IMinAuthPlugin<bigint, string>,
    {
      storageFile: string,
      contractPrivateKey: string,
      feePayerPrivateKey: string
    },
    bigint,
    string>;
