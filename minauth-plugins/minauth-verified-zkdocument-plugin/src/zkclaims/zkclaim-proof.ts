import { CircuitString, Struct, Field, Poseidon, ZkProgram } from 'o1js';
import { Claims } from './vcred-proof';

// TODO consider renaming salt to password
/** The verification of claims is secured with additional salt */
export class ZkClaimValidationContext extends Struct({
  saltedClaimsHash: Field
}) {}

/** The assumption is that the computation is done both in the zk proof
 * and outside of it. Then the outside computation is verified by the hash
 * produced by the ZkClaimProver in `outputVerificationHash`.
 */
export class ZkClaimProofOutput extends Struct({
  outputVerificationHash: Field
}) {}

/** Helper: wrap the actual logic with necessary tests and assertions */
export const mkZkClaimProveMethod =
  ({ proveMethod }: { proveMethod: (claims: Claims) => Field }) =>
  (
    publicInput: ZkClaimValidationContext,
    claims: Claims,
    claimsSalt: Field
  ) => {
    // verify the claims
    const computedSaltedClaimsHash = Poseidon.hash([
      ...claims.toFields(),
      claimsSalt
    ]);
    publicInput.saltedClaimsHash.assertEquals(
      computedSaltedClaimsHash,
      'Claims hash does not match the expected value.'
    );
    // mk the derived claim against the claims
    const verificationHash = proveMethod(claims);

    // return the verification hash
    return new ZkClaimProofOutput({
      outputVerificationHash: verificationHash
    });
  };

export const mkZkClaimProverProgram = ({ name, proveMethod }) => {
  const program = ZkProgram({
    name,
    publicInput: ZkClaimValidationContext,
    publicOutput: ZkClaimProofOutput,
    methods: {
      prove: {
        privateInputs: [Claims, Field],
        method: mkZkClaimProveMethod({ proveMethod })
      }
    }
  });

  return { program };
};

export const fieldNumberGreaterOrEqual = (fieldIndex: number, to: Field) => {
  return {
    claimProver: mkZkClaimProverProgram({
      name: 'fieldNumberGreaterOrEqual',
      proveMethod: (claims: Claims) => {
        const field = claims.toFields()[fieldIndex];
        field.assertGreaterThanOrEqual(
          to,
          `Field ${fieldIndex} must be greater or equal to ${to}`
        );
        const msg = `Field ${fieldIndex} is greater or equal to ${to}`;
        return Poseidon.hash(CircuitString.fromString(msg).toFields());
      }
    })
  };
};
