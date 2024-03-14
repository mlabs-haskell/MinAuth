import { CircuitString, Field, Poseidon } from 'o1js';
import { z } from 'zod';
import {
  ClaimSchema,
  ClaimStandard,
  ClaimStandardSchema,
  IClaim,
  claimStandardHash
} from './claim.js';
import {
  CredSubjectIdSchema,
  IssuerIdSchema,
  VCredIdSchema
} from './data/ids.js';
import {
  FieldSchema,
  SignatureSchema,
  UnixTimestampSchema
} from './data/simple.js';
import { arraysAreEqual } from './helpers/utils.js';

export const CredentialStandardSchema = z.object({
  standardId: z.string().min(2),
  description: z.string().min(2),
  schema: z.record(z.string().min(2), ClaimStandardSchema).refine(
    (schema) => Object.keys(schema).length > 0,
    { message: 'Must define at least one claim.' }
  )
});

export type CredentialStandard = z.infer<typeof CredentialStandardSchema>;

export const credentialStandardHash = (standard: CredentialStandard): Field => {
  const idHash = Poseidon.hash(
    CircuitString.fromString(standard.standardId).toFields()
  );
  const schemaHash = Poseidon.hash(
    Object.values(standard.schema).map(claimStandardHash)
  );
  return Poseidon.hash([idHash, schemaHash]);
};

export const CredentialDataSchema = z.object({
  claims: z.record(z.string().min(1), ClaimSchema(z.unknown())).refine(
    (claims) => Object.keys(claims).length > 0,
    { message: 'Must define at least one claim.' }
  ),
  id: VCredIdSchema,
  issuer: IssuerIdSchema,
  issuanceDate: UnixTimestampSchema,
  expirationDate: UnixTimestampSchema,
  subject: CredSubjectIdSchema,
  credentialSchemaHash: FieldSchema,
});

export const CredentialSchema = CredentialDataSchema.extend({
  signature: SignatureSchema
});

export type CredentialData = z.infer<typeof CredentialDataSchema>;

export type Credential = z.infer<typeof CredentialSchema>;


export const checkCredentialStandardConformance = (
  credential: Credential,
  standard: CredentialStandard
): boolean => {
  // check credential fields presence
  const claimNames = Object.keys(standard.schema);
  const credentialClaimNames = Object.keys(credential.claims);
  if (!arraysAreEqual(claimNames, credentialClaimNames)) {
    return false;
  }

  // check if the fieldValues have the necessary length
  for (const [claimName, claimValue] of Object.entries(credential.claims)) {
    const standardClaim = standard.schema[claimName];
    if (
      claimValue.fieldsValue.length !== standardClaim.fieldsConversion.length
    ) {
      return false;
    }
  }
  return true;
};



// ==========================================
// inline tests

let asd = undefined as unknown as ClaimStandard;

let cred: CredentialStandard = {
  standardId: 'personhood1',
  description: 'Proves that subject is a person',
  schema: {
    name: asd
  }
};

const TypeCheckerTestSchema = ClaimSchema(z.number());
type TypeCheckerTestType = z.infer<typeof TypeCheckerTestSchema>;
const typeCheckerTestValue = undefined as unknown as TypeCheckerTestType;
typeCheckerTestValue satisfies IClaim<number>;
