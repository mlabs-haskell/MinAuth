import {
  Field,
  ZkProgram,
  Poseidon,
  CircuitString,
  Struct,
  Provable,
  Proof
} from 'o1js';

const prog = ZkProgram({
  name: 'IntegerIsGreaterThan',
  publicInput: CircuitString,
  publicOutput: Field,

  methods: {
    fromFieldClaim: {
      privateInputs: [Proof<Field, Field>],
      method(publicInput: CircuitString, fieldClaimProof: Proof<Field, Field>) {
        fieldClaimProof.verify();
        return fieldClaimProof.publicOutput;
      }
    },
    rollupClaims: {
      privateInputs: [Proof<Field, Field>, Proof<Field, Field>],
      method(claim1: Proof<Field, Field>, claim2: Proof<Field, Field>) {
        claim1.verify();
        claim2.verify();
        return claim1.publicOutput;
        // TODO
        // Find a way to preserve information about the claims
        // so that one can verify that the rollup claim is valid
      }
    }
  }
});
