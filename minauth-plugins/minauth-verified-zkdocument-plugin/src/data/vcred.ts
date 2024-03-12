import { Struct, Field, Signature } from 'o1js';
import {
  UnixTimestamp,
  UnixTimestampSchema,
  SignatureSchema,
  FieldSchema
} from './simple.js';
import { IssuerId, VCredId, VCredIdSchema, IssuerIdSchema, CredSubjectId, CredSubjectIdSchema } from './ids.js';
import { Claims } from './claims.js';
import { z } from 'zod';

export function VCredStructUnsigned(claimSizes: number[]) {
  const ClaimsType = Claims(claimSizes);

  const Fields = {
    id: VCredId,
    issuer: IssuerId,
    issuanceDate: UnixTimestamp,
    expirationDate: UnixTimestamp,
    subject: CredSubjectId,
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
        subject: CredSubjectIdSchema,
        claims: ClaimsType.schema,
        credentialSchemaHash: FieldSchema
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

export function VCredStruct(claimSizes: number[]) {
  const BaseVCredStructType = VCredStructUnsigned(claimSizes);

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
