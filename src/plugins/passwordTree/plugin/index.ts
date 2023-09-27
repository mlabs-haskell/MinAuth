import { Experimental, Field, JsonProof, MerkleTree, Poseidon } from "o1js";
import ProvePasswordInTreeProgram, { PASSWORD_TREE_HEIGHT, PasswordTreePublicInput, PasswordTreeWitness } from "./passwordTreeProgram";
import { IMinAuthPlugin, IMinAuthPluginFactory, IMinAuthProver, IMinAuthProverFactory } from 'plugin/pluginType';
import { RequestHandler } from "express";
import { z } from "zod";
import axios from "axios";

const PasswordInTreeProofClass = Experimental.ZkProgram.Proof(ProvePasswordInTreeProgram);

abstract class TreeStorage {
  abstract getRoot(): Promise<Field>;
  abstract getWitness(uid: bigint): Promise<undefined | PasswordTreeWitness>;
  abstract getRole(uid: bigint): Promise<undefined | string>;
}

class InMemoryStorage implements TreeStorage {
  roles: Map<bigint, string>;
  merkleTree: MerkleTree;

  constructor(roleMappings: Array<[bigint, Field, string]> = []) {
    this.roles = new Map();
    this.merkleTree = new MerkleTree(PASSWORD_TREE_HEIGHT);

    roleMappings.forEach(([uid, password, role]) => {
      this.roles.set(uid, role);
      this.merkleTree.setLeaf(uid, Poseidon.hash([password]));
    })
  }

  async getRoot() { return this.merkleTree.getRoot(); }

  async getWitness(uid: bigint) {
    if (!this.roles.has(uid)) return undefined;
    return new PasswordTreeWitness(this.merkleTree.getWitness(uid))
  }

  async getRole(uid: bigint) { return this.roles.get(uid); }
}

const storage = new InMemoryStorage([
  [BigInt(0), Field('7555220006856562833147743033256142154591945963958408607501861037584894828141'), 'admin'],
  [BigInt(1), Field('21565680844461314807147611702860246336805372493508489110556896454939225549736'), 'member']
]);

export class SimplePasswordTreePlugin implements IMinAuthPlugin<bigint, string>{
  readonly verificationKey: string;
  private readonly storage: TreeStorage

  customRoutes: Record<string, RequestHandler> = {
    "/witness/:uid": async (req, resp) => {
      if (req.method != 'GET') {
        resp.status(400);
        return;
      }

      const uid = BigInt(req.params['uid']);
      const witness = await storage.getWitness(uid);

      if (!witness) {
        resp
          .status(400)
          .json({ error: "requested user doesn't exist" });
        return;
      }

      resp.status(200).json(witness);
    },
    "/root": async (req, resp) => {
      if (req.method != 'GET') {
        resp.status(400);
        return;
      }

      const root = await storage.getRoot();
      return resp.status(200).json(root);
    }
  };

  publicInputArgsSchema: z.ZodType<bigint> = z.bigint();

  async verifyAndGetOutput(uid: bigint, jsonProof: JsonProof):
    Promise<string> {
    const proof = PasswordInTreeProofClass.fromJSON(jsonProof);
    const expectedWitness = await storage.getWitness(uid);
    const expectedRoot = await storage.getRoot();
    if (proof.publicInput.witness != expectedWitness ||
      proof.publicInput.root != expectedRoot) {
      throw 'public input invalid';
    }
    const role = await storage.getRole(uid);
    if (!role) { throw 'unknown public input'; }
    return role;
  };

  constructor(verificationKey: string, roles: Array<[bigint, Field, string]>) {
    this.verificationKey = verificationKey;
    this.storage = new InMemoryStorage(roles);
  }

  static async initialize(configuration: { roles: Array<[bigint, Field, string]> })
    : Promise<SimplePasswordTreePlugin> {
    const { verificationKey } = await ProvePasswordInTreeProgram.compile();
    return new SimplePasswordTreePlugin(verificationKey, configuration.roles);
  }

  static readonly configurationSchema: z.ZodType<{ roles: Array<[bigint, Field, string]> }> =
    z.object({
      roles: z.array(z.tuple([
        z.bigint(),
        z.custom<Field>((val) => typeof val === "string" ? /^[0-9]+$/.test(val) : false),
        z.string()]))
    })
}

SimplePasswordTreePlugin satisfies
  IMinAuthPluginFactory<
    IMinAuthPlugin<bigint, string>,
    { roles: Array<[bigint, Field, string]> },
    bigint,
    string>;

export type SimplePasswordTreeProverConfiguration = {
  apiServer: URL
}

export class SimplePasswordTreeProver implements
  IMinAuthProver<bigint, PasswordTreePublicInput, Field>
{
  private readonly cfg: SimplePasswordTreeProverConfiguration;

  async prove(publicInput: PasswordTreePublicInput, secretInput: Field)
    : Promise<JsonProof> {
    const proof = await ProvePasswordInTreeProgram.baseCase(
      publicInput, Field(secretInput));
    return proof.toJSON();
  }

  async fetchPublicInputs(uid: bigint): Promise<PasswordTreePublicInput> {
    const mkUrl = (endpoint: string) => `${this.cfg.apiServer}/${endpoint}`;
    const getWitness = async (): Promise<PasswordTreeWitness> => {
      const resp = await axios.get(mkUrl(`/witness/${uid.toString()}`));
      if (resp.status != 200) {
        throw `unable to fetch witness for ${uid.toString()}, error: ${(resp.data as { error: string }).error}`;
      }
      return PasswordTreeWitness.fromJSON(resp.data);
    };
    const getRoot = async (): Promise<Field> => {
      const resp = await axios.get(mkUrl('/root'));
      return Field.fromJSON(resp.data);
    }
    const witness = await getWitness();
    const root = await getRoot();

    return new PasswordTreePublicInput({ witness, root });
  }

  constructor(cfg: SimplePasswordTreeProverConfiguration) {
    this.cfg = cfg;
  }

  static async initialize(cfg: SimplePasswordTreeProverConfiguration):
    Promise<SimplePasswordTreeProver> {
    return new SimplePasswordTreeProver(cfg);
  }
}

SimplePasswordTreeProver satisfies IMinAuthProverFactory<
  SimplePasswordTreeProver,
  SimplePasswordTreeProverConfiguration,
  bigint,
  PasswordTreePublicInput,
  Field
>
