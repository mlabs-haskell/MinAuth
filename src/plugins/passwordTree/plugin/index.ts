import { Experimental, Field, JsonProof, MerkleTree, Poseidon, verify } from "o1js";
import ProvePasswordInTreeProgram, { PASSWORD_TREE_HEIGHT, PasswordTreePublicInput, PasswordTreeWitness } from "./passwordTreeProgram";
import { PluginType } from 'plugin/pluginType';

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

const compile = async (): Promise<string> => {
  console.log('Compiling SimplePasswordTree program');
  console.log(ProvePasswordInTreeProgram);
  const { verificationKey } = await ProvePasswordInTreeProgram.compile();
  return verificationKey;
}

const verifyAndGetRoleProgram = async (
  jsonProof: JsonProof,
  verificationKey: string,
): Promise<[string | boolean | undefined, string]> => {
  if (!verify(jsonProof, verificationKey)) {
    return [false, 'proof invalid'];
  }
  const proof = PasswordInTreeProofClass.fromJSON(jsonProof);
  const role = await storage.getRole(proof.publicInput.witness.calculateIndex().toBigInt());
  if (!role) { return [undefined, 'unknown public input']; }
  return [role, 'role proved'];
}

async function fetchPublicInput(uid: bigint): Promise<undefined | PasswordTreePublicInput> {
  const root = await storage.getRoot();
  const witness = await storage.getWitness(uid);
  if (!witness) return undefined;
  return new PasswordTreePublicInput({ root, witness });
}

const prove = async (inputs: string[]): Promise<undefined | JsonProof> => {
  const [uidStr, secretInput] = inputs;
  const uid: bigint = BigInt(uidStr);
  const publicInput = await fetchPublicInput(uid);
  if (!publicInput) return undefined;
  const proof = await ProvePasswordInTreeProgram.baseCase(
    publicInput, Field(secretInput));
  return proof.toJSON();
}

// FIXME: I have no idea what this should do
const getInputs = async (): Promise<string[]> => {
  return Array.from(storage.roles.keys()).map(k => k.toString());
};

export const SimplePasswordTree: PluginType = {
  compile,
  getInputs,
  verify: verifyAndGetRoleProgram,
  prove,
}

export default SimplePasswordTree;

