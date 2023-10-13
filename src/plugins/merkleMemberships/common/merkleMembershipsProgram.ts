import {
  Experimental,
  Field,
  MerkleWitness,
  Poseidon,
  SelfProof,
  Struct
} from 'o1js';

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

export class PublicOutput extends Struct({
  recursiveHash: Field
}) {}

// Prove knowledge of a preimage of a hash in a merkle tree.
// The proof does not reveal the preimage nor the hash.
// The output contains a recursive hash of all the roots for which the preimage is known.
// output = hash(lastRoot + hash(secondLastRoot, ... hash(xLastRoot, lastRoot) ...)
// Therefore the order of the proofs matters.
export const Program = Experimental.ZkProgram({
  publicInput: PublicInput,
  publicOutput: PublicOutput,

  methods: {
    baseCase: {
      privateInputs: [PrivateInput],
      method(
        publicInput: PublicInput,
        privateInput: PrivateInput
      ): PublicOutput {
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.merkleRoot);
        return new PublicOutput({
          recursiveHash: publicInput.merkleRoot
        });
      }
    },

    inductiveCase: {
      privateInputs: [SelfProof, PrivateInput],
      method(
        publicInput: PublicInput,
        earlierProof: SelfProof<PublicInput, PublicOutput>,
        privateInput: PrivateInput
      ): PublicOutput {
        earlierProof.verify();
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.merkleRoot);
        return new PublicOutput({
          recursiveHash: Poseidon.hash([
            publicInput.merkleRoot,
            earlierProof.publicOutput.recursiveHash
          ])
        });
      }
    }
  }
});

export default Program;
