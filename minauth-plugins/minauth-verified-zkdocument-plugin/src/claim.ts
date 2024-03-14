import { CircuitString, Field, Poseidon } from 'o1js';
import { z } from 'zod';
import { ClaimStruct, IClaimStruct } from './data/claims.js';
import { FieldsSchema } from './data/simple';

export const ClaimStandardSchema = z.object({
  standardId: z.string().min(2),
  description: z.string(),
  referenceToExternalStandard: z.string().optional(),
  fieldsConversion: z.object({
    length: z.number().int().min(1),
    description: z.string(),
    codeExample: z.string()
  })
});

export type ClaimStandard = z.infer<typeof ClaimStandardSchema>;

export function ClaimSchema<V>(valueSchema: z.ZodType<V>) {
  return z.object({
    name: z.string().min(1),
    value: valueSchema,
    fieldsValue: FieldsSchema,
    standard: ClaimStandardSchema
  });
}

export interface IClaim<V> {
  get name(): string;
  get value(): V;
  get fieldsValue(): Field[];
  get standard(): ClaimStandard;
}

export const claimToStruct = (claim: IClaim<any>): IClaimStruct => {
  const l = claim.fieldsValue.length;
  return ClaimStruct(l).fromFields(claim.fieldsValue);
};

export const claimStandardHash = (standard: ClaimStandard): Field => {
  const idHash = Poseidon.hash(
    CircuitString.fromString(standard.standardId).toFields()
  );
  const optsHash = Poseidon.hash([
    new Field(BigInt(standard.fieldsConversion.length))
  ]);
  return Poseidon.hash([idHash, optsHash]);
};

// ==========================================
// inline tests

const TypeCheckerTestSchema = ClaimSchema(z.number());
type TypeCheckerTestType = z.infer<typeof TypeCheckerTestSchema>;
const typeCheckerTestValue = undefined as unknown as TypeCheckerTestType;
typeCheckerTestValue satisfies IClaim<number>;
