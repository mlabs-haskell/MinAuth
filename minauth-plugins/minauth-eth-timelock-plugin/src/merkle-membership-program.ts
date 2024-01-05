import { Field, MerkleWitness, Poseidon, Struct, ZkProgram } from 'o1js';

// TODO how can this be made dynamic
export const TREE_HEIGHT = 10;

export class TreeWitness extends MerkleWitness(TREE_HEIGHT) {}

export class PrivateInput extends Struct({
  witness: TreeWitness,
  secret: Field
}) {}

export class PublicInput extends Struct({
  merkleRoot: Field
}) {}

/** Prove knowledge of a preimage of a hash in a merkle tree.
 *  The proof does not reveal the preimage nor the hash.
 */
export const Program = ZkProgram({
  name: 'MerkleMembership',
  publicInput: PublicInput,

  methods: {
    proveMembership: {
      privateInputs: [PrivateInput],
      method(publicInput: PublicInput, privateInput: PrivateInput): void {
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.merkleRoot);
      }
    }
  }
});
