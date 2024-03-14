import { Struct, Provable, Field } from 'o1js';
import { ZodTypeAny, z } from 'zod';
import { FieldsSchema } from './simple.js';
import { arraysAreEqual, ftn } from '../helpers/utils.js';

const CLAIMS_MAX_SIZE = 128;

export interface IClaimStruct {
  get length(): Field;
  get claimValue(): Field[];
  toFields(): Field[];
}

export interface IClaimStructClass {
  new (claimValue: Field[]): IClaimStruct;
  fromFields(fields: Field[]): IClaimStruct;
  schema: z.ZodType<any>;
}

export interface IFieldClaims {
  count: Field;
  packed: Field[];
  toFields(): Field[];
  getClaim(ix: Field, assert: Field[]): Field[];
}

export const ClaimStruct = (length: number): IClaimStructClass => {
  class Claim_
    extends Struct({
      length: Field,
      claimValue: Provable.Array(Field, length)
    })
    implements IClaimStruct
  {
    constructor(claimValue: Field[]) {
      if (claimValue.length !== length) {
        throw new Error(`Invalid claim array size: ${claimValue.length}`);
      }
      super({ length: new Field(length), claimValue });
    }

    public toFields() {
      return [this.length, ...this.claimValue];
    }

    static fromFields(fields: Field[]) {
      const length = Number(fields[0].toBigInt());
      if (fields.length !== length + 1) {
        throw new Error(`Invalid claim array size: ${fields.length}`);
      }
      return new Claim_(fields.slice(1, length + 1));
    }

    static schema = z
      .object({
        claimValue: FieldsSchema.length(length)
      })
      .transform((o) => new Claim_(o.claimValue));
  }

  return Claim_ as IClaimStructClass;
};

export const mkClaimStruct = (flds: Field[]) => {
  const n = flds.length;
  return ClaimStruct(n).fromFields(flds);
};

export const computeClaimSizes = (claims: IClaimStruct[]) => {
  return claims.map(c => ftn(c.length));
};

export const mkClaims = (claims: IClaimStruct[]): IFieldClaims => {
  const size = computeClaimSizes(claims);
  return Claims(size).fromClaims(claims);
};

export function Claims(claimSizes: number[]) {
  if (claimSizes.length == 0) {
    throw new Error('claimSizes must not be empty.');
  }
  const claimCount = claimSizes.length;
  // 0 (start index) + indices + claims
  const totalSize = 1 + claimCount + claimSizes.reduce((a, v) => a + v, 0);

  if (totalSize > CLAIMS_MAX_SIZE) {
    throw new Error(
      `Total Claims size ${totalSize} exceeds the maximum size ${CLAIMS_MAX_SIZE}`
    );
  }

  class Claims_
    extends Struct({
      count: Field,
      packed: Provable.Array(Field, totalSize)
    })
    implements IFieldClaims
  {
    static MAX_SIZE = CLAIMS_MAX_SIZE;

    public toFields() {
      return [this.count, ...this.packed];
    }

    static fromClaims(claims: IClaimStruct[]) {
      const receivedSizes = claims.map((c) => ftn(c.length));

      if (!arraysAreEqual(receivedSizes, claimSizes)) {
        throw new Error("'claims' array sizes are invalid");
      }

      let packed: Field[] = [];
      // first push all locations
      packed.push(new Field(0));
      for (let i = 0; i < claims.length; i++) {
        const claimEndIx = packed[i].add(claims[i].length);
        packed.push(claimEndIx);
      }
      // then push all values
      for (const claim of claims) {
        packed.push(...claim.claimValue);
      }

      return new Claims_({ count: new Field(claims.length), packed });
    }

    static get schema() {
      const claimSchemas = claimSizes.map(
        (size) => ClaimStruct(size).schema
      ) as [ZodTypeAny, ...ZodTypeAny[]];
      return z
        .tuple(claimSchemas)
        .transform((claims) => Claims_.fromClaims(claims));
    }

    public getClaim(ix: Field, assert: Field[]): Field[] {
      const i = Number(ix.toBigInt());
      const length = Number(this.packed[i + 1].sub(this.packed[i]).toBigInt());
      const c = Number(this.count.toBigInt());

      const op = Provable.witness(Provable.Array(Field, length), () => {
        const start = Number(this.packed[i].toBigInt());
        const next = Number(this.packed[i + 1].toBigInt());
        return this.packed.slice(c + 1 + start, c + 1 + next);
      });

      for (let j = 0; j < length; j++) {
        op[j].assertEquals(assert[j]);
      }

      return op;
    }
  }

  return Claims_;
}
