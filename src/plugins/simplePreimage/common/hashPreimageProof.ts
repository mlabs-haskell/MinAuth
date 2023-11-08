import { Field, Poseidon, ZkProgram } from 'o1js';

/**
 * O1JS ZK program that checks if private input is a hash preimage of public input.
 */
export const ProvePreimageProgram = ZkProgram({
  name: 'ProvePreimage',
  publicInput: Field,
  publicOutput: Field,

  methods: {
    baseCase: {
      privateInputs: [Field],
      method(publicInput: Field, secretInput: Field) {
        Poseidon.hash([secretInput]).assertEquals(publicInput);
        return publicInput;
      }
    }
  }
});

export const ProvePreimageProofClass = ZkProgram.Proof(ProvePreimageProgram);

export default ProvePreimageProgram;
