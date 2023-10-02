import { Experimental, Field, MerkleWitness, Poseidon, Struct } from "o1js";

export const PASSWORD_TREE_HEIGHT = 10;

export class PasswordTreeWitness extends MerkleWitness(PASSWORD_TREE_HEIGHT) { }

export class PasswordTreePublicInput extends Struct({
  witness: PasswordTreeWitness,
  root: Field
}) { };

export const ProvePasswordInTreeProgram = Experimental.ZkProgram({
  publicInput: PasswordTreePublicInput,
  publicOutput: Field,

  methods: {
    baseCase: {
      privateInputs: [Field],
      method(publicInput: PasswordTreePublicInput, privateInput: Field): Field {
        publicInput.witness
          .calculateRoot(Poseidon.hash([privateInput]))
          .assertEquals(publicInput.root);
        return publicInput.witness.calculateIndex();
      }
    }
  }
});

export default ProvePasswordInTreeProgram;