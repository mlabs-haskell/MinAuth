import { Struct, Field, PublicKey, Signature } from 'o1js';
import {
  UnixTimestamp,
  UnixTimestampSchema,
  PublicKeyB58Schema,
  FieldSchemaDec,
  FieldSchemaHex,
  SignatureSchema
} from './simple.js';
import { IssuerId, VCredId, VCredIdSchema, IssuerIdSchema } from './ids.js';
import { Claims } from './claims.js';
import { z } from 'zod';

export function VCredStructUnsigned(n: number) {
  const ClaimsType = Claims(n);

  if (n <= 0 || n > ClaimsType.MAX_SIZE) {
    // Adjust the limits as necessary.
    throw new Error(`Invalid claims array size: ${n}`);
  }

  const Fields = {
    id: VCredId,
    issuer: IssuerId,
    issuanceDate: UnixTimestamp,
    expirationDate: UnixTimestamp,
    subject: PublicKey,
    claims: ClaimsType,
    credentialSchemaHash: Field
  };

  class BaseVCredStruct_ extends Struct(Fields) {
    static Fields = Fields;

    public toFields() {
      return [
        this.id,
        ...this.issuer.toFields(),
        this.issuanceDate,
        this.expirationDate,
        ...this.subject.toFields(),
        ...this.claims.toFields(),
        this.credentialSchemaHash
      ];
    }

    static get dataSchema() {
      return z.object({
        id: VCredIdSchema,
        issuer: IssuerIdSchema,
        issuanceDate: UnixTimestampSchema,
        expirationDate: UnixTimestampSchema,
        subject: PublicKeyB58Schema,
        claims: ClaimsType.schema,
        credentialSchemaHash: FieldSchemaDec.or(FieldSchemaHex)
      });
    }

    static get schema() {
      return BaseVCredStruct_.dataSchema.transform(
        (data) => new BaseVCredStruct_(data)
      );
    }
  }

  return BaseVCredStruct_;
}

export function VCredStruct(n: number) {
  const BaseVCredStructType = VCredStructUnsigned(n);

  const Fields = { ...BaseVCredStructType.Fields, signature: Signature };

  class VCredStruct_ extends Struct(Fields) {
    static Fields = Fields;

    public contentToFields() {
      return new BaseVCredStructType(this).toFields();
    }

    public toFields() {
      return [...this.contentToFields(), ...this.signature.toFields()];
    }

    static get dataSchema() {
      return BaseVCredStructType.dataSchema.extend({
        signature: SignatureSchema
      });
    }

    static get schema() {
      return VCredStruct_.dataSchema.transform(
        (data) => new VCredStruct_(data)
      );
    }
  }

  return VCredStruct_;
}
