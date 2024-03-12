import {
  Field,
  PublicKey,
  Struct,
} from 'o1js';
import { Logger } from 'tslog';
import { z } from 'zod';
import * as SimpleSchemas from './simple.js';

export class PubKeyId extends Struct({
  pubkey: PublicKey
}) {
  public toFields() {
    return this.pubkey.toFields();
  }
}
export const PubKeyIdSchema = z
  .object({
    pubkey: SimpleSchemas.PublicKeyB58Schema
  })
  .transform((o) => new IssuerId({ pubkey: o.pubkey }));

/**
 * Represents an issuer with a public key. Future versions might replace this
 * with a more complex ID system, such as DIDs.
 */
export class IssuerId extends PubKeyId {}

export const IssuerIdSchema = PubKeyIdSchema;


/**
 * Represents a subject with a public key. Future versions might replace this
 * with a more complex ID system, such as DIDs.
 */
export class CredSubjectId extends PubKeyId {}

export const CredSubjectIdSchema = PubKeyIdSchema;


export class VCredId extends Struct({
  id: Field
}) {
  public toFields() {
    return this.id.toFields();
  }
}

export const VCredIdSchema = z
  .object({
    id: z.union([SimpleSchemas.FieldSchemaDec, SimpleSchemas.FieldSchemaHex])
  })
  .transform((o) => new VCredId({ id: o.id }));

export const inline_tests = () => {
  const log = new Logger({ name: 'simple schema inline tests' });

  const issuer = IssuerIdSchema.parse({
    pubkey: 'B62qnH2ZHFKinYSMEHCcmu7Z7ijeqRTa6KRHF5KUCXnfDvPkysg5TSL'
  });
  log.info('Parsed issuer: ', issuer.toFields());

  try {
    IssuerIdSchema.parse({ pubkey: 'abc' });
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Caught error: ', err.message);
  }

  const vcredid = VCredIdSchema.parse({ id: '123' });
  log.info('Parsed vcredid: ', vcredid.toFields());

  try {
    VCredIdSchema.parse({ id: 'abc' });
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Caught error: ', err.message);
  }
};
