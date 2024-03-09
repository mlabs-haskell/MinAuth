import { Poseidon, Field, Proof, SelfProof, Struct, ZkProgram } from 'o1js';
import { ValidateVCredProof } from './vcred-proof';
import { ZkClaimProofOutput, ZkClaimValidationContext } from './zkclaim-proof';

/**
 * Context for VCred validation, defining the valid timeframe.
 * The fields are Unix UTC timestamps.
 */
export class ZkClaimRollupValidationContext extends Struct({
  validFrom: Field,
  validTo: Field,
  vCredIdentificationHash: Field
}) {}

/** The assumption is that the computation is done both in the zk proof
 * and outside of it.
 * During a rollup all the resulting derived claims are combined and the
 * hash of results is combined as well.
 * In the non-recursive case the rollupOutputVerificationHash is the same as
 * claimOutputVerificationHash.
 * In the recursive case the rollup resulting hash is computed like this:
 * `hash(rollupOutputVerificationHash, claimOutputVerificationHash)`
 */
export class ZkClaimRollupProofOutput extends Struct({
  outputVerificationHash: Field
}) {}

// TODO: needs to come from actual provers dynamically
// class proofType = ZkProgram.Proof(theprover);
class ZkClaimValidationProof extends Proof<
  ZkClaimValidationContext,
  ZkClaimProofOutput
> {}

/** This Program allows to rollup multiple claims against a single VCred.
 * The result will be a single proof.
 * It is assumed that necessary data (required to match the proved output hash)
 * is gathered outside of the built zk proof.
 */
export const ValidateZkClaimProgram = ZkProgram({
  name: 'ValidateZkClaim',
  publicInput: ZkClaimRollupValidationContext,
  publicOutput: ZkClaimRollupProofOutput,
  methods: {
    firstClaim: {
      privateInputs: [ValidateVCredProof, ZkClaimValidationProof],
      method(
        publicInput: ZkClaimRollupValidationContext,
        credProof: ValidateVCredProof,
        claimProof: ZkClaimValidationProof
      ): ZkClaimRollupProofOutput {
        // verify proofs
        credProof.verify();
        claimProof.verify();

        // verify contexts
        publicInput.vCredIdentificationHash.assertEquals(
          credProof.publicOutput.identificationHash
        );
        publicInput.validFrom.assertGreaterThanOrEqual(
          credProof.publicInput.validFrom
        );
        publicInput.validTo.assertLessThanOrEqual(
          credProof.publicInput.validTo
        );

        // verify claim link to credential
        claimProof.publicInput.saltedClaimsHash.assertEquals(
          credProof.publicOutput.saltedClaimsHash
        );

        // output
        const verificationHash = claimProof.publicOutput.outputVerificationHash;

        return new ZkClaimRollupProofOutput({
          outputVerificationHash: verificationHash
        });
      }
    },
    recursiveClaim: {
      privateInputs: [SelfProof, ZkClaimValidationProof],
      method(
        publicInput: ZkClaimRollupValidationContext,
        rollupProof: SelfProof<
          ZkClaimRollupValidationContext,
          ZkClaimRollupProofOutput
        >,
        claimProof: ZkClaimValidationProof
      ): ZkClaimRollupProofOutput {
        // verify proofs
        rollupProof.verify();
        claimProof.verify();

        // verify contexts
        publicInput.vCredIdentificationHash.assertEquals(
          rollupProof.publicInput.vCredIdentificationHash
        );
        publicInput.validFrom.assertGreaterThanOrEqual(
          rollupProof.publicInput.validFrom
        );
        publicInput.validTo.assertLessThanOrEqual(
          rollupProof.publicInput.validTo
        );

        // verify claim link to rollup credential
        claimProof.publicInput.saltedClaimsHash.assertEquals(
          rollupProof.publicInput.vCredIdentificationHash
        );

        const outputVerificationHash = Poseidon.hash([
          rollupProof.publicOutput.outputVerificationHash,
          claimProof.publicOutput.outputVerificationHash
        ]);

        return new ZkClaimRollupProofOutput({
          outputVerificationHash
        });
      }
    }
  }
});
