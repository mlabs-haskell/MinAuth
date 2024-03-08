import { Field, Proof, SelfProof, Struct, ZkProgram} from 'o1js';
import { ValidateVCredProof } from './vcred-proof';
import { ZkClaimProofOutput, ZkClaimValidationContext } from './zkclaim-proof';

/**
 * Context for VCred validation, defining the valid timeframe.
 * The fields are UTC Unix timestamps.
 */
export class ZkClaimRollupValidationContext extends Struct({
  validFrom: Field,
  validTo: Field,
  identificationHash: Field,
}) {}

/** The assumption is that the computation is done both in the zk proof
 * and outside of it.
 * During a rollup all the resulting derived claims are combined and the
 * hash of results is combined as well.
 */
export class ZkClaimRollupProofOutput extends Struct({
  outputVerificationHash: Field
}) {}

// TODO: needs to come from actual provers dynamically
// class proofType = ZkProgram.Proof(theprover);
class ZkClaimValidationProof extends Proof<ZkClaimValidationContext, ZkClaimProofOutput>{}

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
        claimProof: ZkClaimValidationProof,
      ): ZkClaimRollupProofOutput {

        // verify proofs
        credProof.verify();
        claimProof.verify();

        // verify contexts
        publicInput.identificationHash.assertEquals(credProof.publicOutput.identificationHash);
        publicInput.validFrom.assertGreaterThanOrEqual(credProof.publicInput.validFrom);
        publicInput.validTo.assertLessThanOrEqual(credProof.publicInput.validTo);

        // output
        const verificationHash = claimProof.publicOutput.outputVerificationHash;

        return new ZkClaimRollupProofOutput({ outputVerificationHash: verificationHash });
      }
    },
    recursiveClaim: {
      privateInputs: [SelfProof, ZkClaimValidationProof],
      method(
        publicInput: ZkClaimRollupValidationContext,
        rollupProof: SelfProof<ZkClaimRollupValidationContext, ZkClaimRollupProofOutput>,
        claimProof: ZkClaimValidationProof,
      ): ZkClaimRollupProofOutput {

        // TODO

        return undefined as unknown as ZkClaimRollupProofOutput;

      }
    }
  }
});

