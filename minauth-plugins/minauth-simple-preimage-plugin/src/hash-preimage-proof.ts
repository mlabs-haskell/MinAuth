import { Field, ZkProgram, Poseidon } from 'o1js';

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
