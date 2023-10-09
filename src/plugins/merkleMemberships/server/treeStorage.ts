import { AccountUpdate, Field, MerkleTree, Mina, PrivateKey } from "o1js";
import * as O from 'fp-ts/Option';
import * as Program from '../common/merkleMembershipsProgram';
import z from 'zod';
import fs from "fs/promises"
import { TreeRootStorageContract } from '../common/treeRootStorageContract';
import * as A from 'fp-ts/Array';
import { Option } from 'fp-ts/Option';

export interface TreeStorage {
  getRoot(): Promise<Field>;
  getWitness(leafIndex: bigint): Promise<O.Option<Program.TreeWitness>>;
  hasLeaf(leafIndex: bigint): Promise<boolean>;
  setLeaf(leafIndex: bigint, leaf: Field): Promise<void>;
}

export class InMemoryStorage implements TreeStorage {
  occupied: Set<bigint> = new Set();
  merkleTree: MerkleTree = new MerkleTree(Program.TREE_HEIGHT);

  async getRoot() { return this.merkleTree.getRoot(); }

  async getWitness(leafIndex: bigint): Promise<O.Option<Program.TreeWitness>> {
    return this.occupied.has(leafIndex) ?
      O.none :
      O.some(new Program.TreeWitness(this.merkleTree.getWitness(leafIndex)));
  }

  async hasLeaf(leafIndex: bigint): Promise<boolean> {
    return this.occupied.has(leafIndex);
  }

  async setLeaf(leafIndex: bigint, leaf: Field): Promise<void> {
    this.occupied.add(leafIndex);
    this.merkleTree.setLeaf(leafIndex, leaf);
  }
}

export class PersistentInMemoryStorage extends InMemoryStorage {
  readonly file: fs.FileHandle;

  async persist() {
    const storageObj =
      Array
        .from(this.occupied.values())
        .reduce((acc: Record<number, string>, idx: bigint) => {
          acc[Number(idx)] =
            this.merkleTree
              .getNode(Program.TREE_HEIGHT, idx)
              .toJSON();
          return acc;
        }
          , {});
    await this.file.write(JSON.stringify(storageObj), 0, 'utf-8');
  }

  private constructor(
    file: fs.FileHandle,
    occupied: Set<bigint>,
    merkleTree: MerkleTree) {
    super();
    this.file = file;
    this.occupied = occupied;
    this.merkleTree = merkleTree;
  }

  static async initialize(path: string): Promise<PersistentInMemoryStorage> {
    const handle = await fs.open(path, 'r+');
    const content = await handle.readFile('utf-8');
    const storageObj: Record<number, string> =
      JSON.parse(content);
    const occupied: Set<bigint> = new Set();
    const merkleTree: MerkleTree = new MerkleTree(Program.TREE_HEIGHT);

    Object
      .entries(storageObj)
      .forEach(([rawIdx, rawLeaf]) => {
        const idx = BigInt(rawIdx);
        occupied.add(BigInt(rawIdx));
        merkleTree.setLeaf(idx, Field.fromJSON(rawLeaf));
      });

    return new PersistentInMemoryStorage(handle, occupied, merkleTree);
  }
}


export class GenericMinaBlockchainTreeStorage<T extends TreeStorage> implements TreeStorage {
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

  async getWitness(leafIdx: bigint) {
    return this.underlyingStorage.getWitness(leafIdx);
  }

  async hasLeaf(leafIdx: bigint): Promise<boolean> {
    return this.underlyingStorage.hasLeaf(leafIdx);
  }

  async setLeaf(leafIndex: bigint, leaf: Field): Promise<void> {
    this.underlyingStorage.setLeaf(leafIndex, leaf);
    await this.updateTreeRootOnChainIfNecessary();
  }
}

async function initializeGenericMinaBlockchainTreeStorage<T extends TreeStorage>(
  storage: T,
  contractPrivateKey: PrivateKey,
  feePayerPrivateKey: PrivateKey
): Promise<GenericMinaBlockchainTreeStorage<T>> {
  await TreeRootStorageContract.compile();
  const contract = new TreeRootStorageContract(contractPrivateKey.toPublicKey());
  const feePayerPublicKey = feePayerPrivateKey.toPublicKey();

  const mkTx = async (txFn: () => void): Promise<void> => {
    const txn = await Mina.transaction(feePayerPublicKey, txFn);
    await txn.prove();
    await txn.sign([feePayerPrivateKey, contractPrivateKey]).send();
  };

  const blockchainStorage = new GenericMinaBlockchainTreeStorage(storage, contract, mkTx);

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

export class MinaBlockchainTreeStorage
  extends GenericMinaBlockchainTreeStorage<PersistentInMemoryStorage>{
  static async initialize(
    path: string,
    contractPrivateKey: PrivateKey,
    feePayerPrivateKey: PrivateKey) {
    const storage = await PersistentInMemoryStorage.initialize(path);
    return initializeGenericMinaBlockchainTreeStorage(
      storage,
      contractPrivateKey,
      feePayerPrivateKey);
  }
}

export interface TreesProvider {
  getTree(root: Field): Promise<Option<TreeStorage>>;
}

export const minaTreesProviderConfigurationSchema =
  z.object({
    feePayerPrivateKey: z.string().optional(),
    trees: z.array(z.object({
      contractPrivateKey: z.string().optional(),
      offchainStoragePath: z.string()
    }))
  });


export type MinaTreesProviderConfiguration =
  z.infer<typeof minaTreesProviderConfigurationSchema>;

export class MinaTreesProvider implements TreesProvider {
  readonly treeStorages: Array<TreeStorage>;

  async getTree(root: Field) {
    for (const tree of this.treeStorages) {
      const thisRoot = await tree.getRoot();
      if (thisRoot.equals(root).toBoolean())
        return O.some(tree);
    }
    return O.none;
  }

  constructor(treeStorages: Array<TreeStorage>) {
    this.treeStorages = treeStorages;
  }

  static async initialize(cfg: MinaTreesProviderConfiguration):
    Promise<MinaTreesProvider> {
    const feePayerPrivateKey = cfg.feePayerPrivateKey ?
      PrivateKey.fromBase58(cfg.feePayerPrivateKey) : undefined;

    const trees: TreeStorage[] = await
      A.reduce
        (Promise.resolve([]),
          (
            accP: Promise<Array<TreeStorage>>,
            tCfg: {
              offchainStoragePath: string;
              contractPrivateKey?: string | undefined;
            }) => accP.then(
              (acc) =>
                (
                  feePayerPrivateKey && tCfg.contractPrivateKey ?
                    MinaBlockchainTreeStorage.initialize(
                      tCfg.offchainStoragePath,
                      PrivateKey.fromBase58(tCfg.contractPrivateKey),
                      feePayerPrivateKey) :
                    PersistentInMemoryStorage.initialize(tCfg.offchainStoragePath)
                ).then((storage: TreeStorage) =>
                  Promise.resolve(A.append(storage)(acc)))
            ))
        (cfg.trees)

    return new MinaTreesProvider(trees);
  };
}
