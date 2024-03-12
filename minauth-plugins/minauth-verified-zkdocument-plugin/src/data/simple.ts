import { Field, PublicKey, Struct, Signature } from 'o1js';
import { Logger } from 'tslog';
import { z } from 'zod';

export const FieldSchemaInt = z.number().int().transform((n) => new Field(BigInt(n)));
export const FieldSchemaBigInt = z.bigint().transform(Field);
export const FieldSchemaDec = z.string().regex(/^\d+$/).transform(Field);
export const FieldSchemaHex = z
  .string()
  .regex(/^(0x|0X)?[0-9a-fA-F]+$/)
  .transform((s) => Field(BigInt(s)));

export const FieldSchema = z.union([FieldSchemaInt, FieldSchemaBigInt, FieldSchemaDec,FieldSchemaHex]);
export const FieldsSchema = z.array(FieldSchema);
export const Base58Schema = z.string().regex(/^[A-HJ-NP-Za-km-z1-9]+$/);
export const PublicKeyB58Schema = Base58Schema.length(55).transform(
  PublicKey.fromBase58
);
export const SignatureSchema = z
  .object({
    signatureBase58: Base58Schema.length(96)
  })
  .transform((o) => Signature.fromBase58(o.signatureBase58));

export class UnixTimestamp extends Struct({
  unixTimestamp: Field
}) {
  public toFields() {
    return this.unixTimestamp.toFields();
  }
}

export const UnixTimestampSchema = z
  .object({
    unixTimestamp: FieldSchemaDec
  })
  .transform((o) => new UnixTimestamp({ unixTimestamp: o.unixTimestamp }));


export const inline_tests = () => {
  const log = new Logger({ name: 'simple schema inline tests' });

    const fieldi = 123;
    const f1: Field = FieldSchemaInt.parse(fieldi);
    log.info('Parsed field from int encoding: ', fieldi, f1);


    const fieldbigi = 123n;
    const f2: Field = FieldSchemaBigInt.parse(fieldbigi);
    log.info('Parsed field from big int encoding: ', fieldbigi, f2);


  // const PublicKeySchema = z.string().transform(PrivateKey.from);
  const fielddecstr = '123';
  const field: Field = FieldSchemaDec.parse(fielddecstr);
  log.info('Parsed field from dec encoding: ', fielddecstr, field.toString());
  try {
    FieldSchemaDec.parse('abc');
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Valid error: ', err.message);
  }

  const fieldhexstr = '0x123';
  const fieldhex: Field = FieldSchemaHex.parse(fieldhexstr);
  log.info(
    'Parsed field from hex encoding: ',
    fieldhexstr,
    fieldhex.toString()
  );
  try {
    FieldSchemaHex.parse('0xzbc');
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Valid error: ', err.message);
  }

  const fieldsencoded = ['123', '0x123'];
  const fields: Field[] = FieldsSchema.parse(fieldsencoded);
  log.info(
    'Parsed fields from encoded array: ',
    fieldsencoded,
    fields.map((f) => f.toString())
  );

  const pubkeystr = 'B62qnH2ZHFKinYSMEHCcmu7Z7ijeqRTa6KRHF5KUCXnfDvPkysg5TSL';
  const pubkey: PublicKey = PublicKeyB58Schema.parse(pubkeystr);
  log.info('Parsed public key from base58: ', pubkeystr, pubkey.toBase58());
  try {
    PublicKeyB58Schema.parse('abc');
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Valid error: ', err.message);
  }

  // tests for unix timestamp
  const unixTimestampStr = '123';
  const unixTimestamp: UnixTimestamp = UnixTimestampSchema.parse({
    unixTimestamp: unixTimestampStr
  });
  log.info(
    'Parsed unix timestamp from dec encoding: ',
    unixTimestampStr,
    unixTimestamp.toFields()
  );
  try {
    UnixTimestampSchema.parse({ unixTimestamp: 'abc' });
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Valid error: ', err.message);
  }

  const signature = SignatureSchema.parse({
    signature:
      '7mX64qh7mUUn5jnWUAAg1o39xwic6vvCq9uwuVSDqTJ7bLD69qtRzn3BzzLu95exgJWxTUUTexdsVv5MFu46RoxrPxF1ZpXE'
  });
  log.info('Parsed signature: ', signature.toBase58());

  try {
    SignatureSchema.parse({
      signature:
        'mX64qh7mUUn5jnWUAAg1o39xwic6vvCq9uwuVSDqTJ7bLD69qtRzn3BzzLu95exgJWxTUUTexdsVv5MFu46RoxrPxF1ZpXE'
    });
  } catch (e) {
    const err = e as z.ZodError;
    log.debug('Valid error: ', err.message);
  }
};
