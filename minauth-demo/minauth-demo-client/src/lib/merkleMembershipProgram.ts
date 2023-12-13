import {
  Experimental,
  Field,
  MerkleWitness,
  Poseidon,
  SelfProof,
  Struct
} from 'o1js';

// TODO how can this be made dynamic
export const MERKLE_MEMBERSHIP_TREE_HEIGHT = 10;

export class MerkleMembershipTreeWitness extends MerkleWitness(
  MERKLE_MEMBERSHIP_TREE_HEIGHT
) {}

export class MerkleMembershipsPrivateInputs extends Struct({
  witness: MerkleMembershipTreeWitness,
  secret: Field
}) {}

export class MerkleRoot extends Struct({
  root: Field
}) {}

export class MerkleMembershipsOutput extends Struct({
  recursiveHash: Field
}) {}

// Prove knowledge of a preimage of a hash in a merkle tree.
// The proof does not reveal the preimage nor the hash.
// The output contains a recursive hash of all the roots for which the preimage is known.
// output = hash(lastRoot + hash(secondLastRoot, ... hash(xLastRoot, lastRoot) ...)
// Therefore the order of the proofs matters.
export const MerkleMembershipsProgram = Experimental.ZkProgram({
  publicInput: MerkleRoot,
  publicOutput: MerkleMembershipsOutput,

  methods: {
    baseCase: {
      privateInputs: [MerkleMembershipsPrivateInputs],
      method(
        publicInput: MerkleRoot,
        privateInput: MerkleMembershipsPrivateInputs
      ): MerkleMembershipsOutput {
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.root);
        return new MerkleMembershipsOutput({
          recursiveHash: publicInput.root
        });
      }
    },

    inductiveCase: {
      privateInputs: [SelfProof, MerkleMembershipsPrivateInputs],
      method(
        publicInput: MerkleRoot,
        earlierProof: SelfProof<MerkleRoot, MerkleMembershipsOutput>,
        privateInput: MerkleMembershipsPrivateInputs
      ): MerkleMembershipsOutput {
        earlierProof.verify();
        privateInput.witness
          .calculateRoot(Poseidon.hash([privateInput.secret]))
          .assertEquals(publicInput.root);
        return new MerkleMembershipsOutput({
          recursiveHash: Poseidon.hash([
            publicInput.root,
            earlierProof.publicOutput.recursiveHash
          ])
        });
      }
    }
  }
});

export default MerkleMembershipsProgram;
