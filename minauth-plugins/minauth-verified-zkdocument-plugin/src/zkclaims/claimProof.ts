import { UInt32, Proof, Field, ZkProgram, Poseidon, CircuitString, Struct } from 'o1js';

export const MAX_VCRED_SIZE = 128;

export class ClaimLocation extends Struct({
  start: UInt32,
  end: UInt32
}) {}

export class ZkClaimPublicInput extends Struct({
  credentialHash: Field,
  claimLocation: ClaimLocation,
}) {}

export class ZkClaimSecretInput extends Struct({
  credential: CircuitString,
}) {}

export class ZkClaimOutput extends Struct({
  resultValue: CircuitString,
}) {}

export const ZkClaimProof = Proof<ZkClaimPublicInput, ZkClaimOutput>;
export type ZkClaimProof = Proof<ZkClaimPublicInput, ZkClaimOutput>;


export const RollupZkClaimProofProgram = ZkProgram({
  name: 'RollupClaimProof',
  publicInput: ZkClaimPublicInput,
  publicOutput: ZkClaimOutput,

  methods: {
    rollup2: {
      privateInputs: [ZkClaimProof, ZkClaimProof],
      method(publicInput: ZkClaimPublicInput, proof1: ZkClaimProof, proof2: ZkClaimProof): ZkClaimOutput {

        // make sure that sub-proofs are concerned with the same credential
        publicInput.credentialHash.assertEquals(proof1.publicInput.credentialHash);
        publicInput.credentialHash.assertEquals(proof2.publicInput.credentialHash);

        // make sure that sub-proofs are concerned with the same claims
        publicInput.claimLocation.start.assertLessThanOrEqual(proof1.publicInput.claimLocation.start);
        publicInput.claimLocation.start.assertLessThanOrEqual(proof2.publicInput.claimLocation.start);
        publicInput.claimLocation.end.assertGreaterThanOrEqual(proof1.publicInput.claimLocation.end);
        publicInput.claimLocation.end.assertGreaterThanOrEqual(proof2.publicInput.claimLocation.end);

        proof1.verify();
        proof2.verify();

        return new ZkClaimOutput({ resultValue: Poseidon.hash(proof1.publicOutput.resultValue.concat(proof2.publicOutput.resultValue).toFields()) });
      }
    }
  }
});


