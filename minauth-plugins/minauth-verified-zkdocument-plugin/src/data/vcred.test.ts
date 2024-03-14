import { Field, PrivateKey, Signature } from 'o1js';
import { VCredStruct, VCredStructUnsigned } from './vcred.js'; // Update import path as needed
import { ClaimStruct, IClaimStruct, mkClaims } from './claims.js'; // Import necessary dependencies
import { CredSubjectId, IssuerId, VCredId } from './ids.js';
import { UnixTimestamp } from './simple.js';

describe('VCredStruct tests', () => {
  const pk1 = PrivateKey.random().toPublicKey();
  const pk1s: string = pk1.toBase58();
  const pk2 = PrivateKey.random().toPublicKey();
  const pk2s = pk2.toBase58();

  let claim1: IClaimStruct;
  let claim2: IClaimStruct;

  const claim1s = {
    claimValue: [1, 2, 3]
  };
  const claim2s = {
    claimValue: ['0x456', 0x789]
  };

  beforeAll(() => {
    claim1 = ClaimStruct(3).schema.parse(claim1s);
    claim2 = ClaimStruct(2).schema.parse(claim2s);
  });

  const ClaimSizes = [3, 2];
  const VCredStructUnsignedType = VCredStructUnsigned(ClaimSizes);
  const VCredStructType = VCredStruct(ClaimSizes);

  const testData = () => {
    return {
      id: new VCredId({ id: new Field(123) }),
      issuer: new IssuerId({ pubkey: pk1 }),
      issuanceDate: new UnixTimestamp({ unixTimestamp: new Field(123123123) }),
      expirationDate: new UnixTimestamp({
        unixTimestamp: new Field(223123123)
      }),
      subject: new CredSubjectId({ pubkey: pk2 }),
      claims: mkClaims([claim1, claim2]),
      credentialSchemaHash: new Field(789)
    };
  };

  describe('VCredStructUnsigned', () => {
    it('should instantiate correctly with valid data', () => {
      const instance = new VCredStructUnsignedType(testData());
      expect(instance).toBeInstanceOf(VCredStructUnsignedType);
      expect(instance.toFields()).toEqual(
        expect.arrayContaining([expect.any(Field)])
      );
    });

    it('should parse from valid data with its zod schema', () => {
      expect(VCredStructUnsignedType.dataSchema).toBeDefined();
      const validation = VCredStructUnsignedType.dataSchema.safeParse({
        id: { id: '123' },
        issuer: { pubkey: pk1s },
        issuanceDate: { unixTimestamp: '123123123' },
        expirationDate: { unixTimestamp: '223123123' },
        subject: { pubkey: pk2s },
        claims: [claim1s, claim2s],
        credentialSchemaHash: '789'
      });

      if (!validation.success) {
        console.log(validation.error);
      }

      expect(validation.success).toBeTruthy();
    });
  });

  describe('VCredStruct', () => {
    const testDataSig = () => {
      return {
        id: new VCredId({ id: new Field(123) }),
        issuer: new IssuerId({ pubkey: pk1 }),
        issuanceDate: new UnixTimestamp({
          unixTimestamp: new Field(123123123)
        }),
        expirationDate: new UnixTimestamp({
          unixTimestamp: new Field(223123123)
        }),
        subject: new CredSubjectId({ pubkey: pk2 }),
        claims: mkClaims([claim1, claim2]),
        credentialSchemaHash: new Field(789),
        signature: Signature.fromBase58('7mX64qh7mUUn5jnWUAAg1o39xwic6vvCq9uwuVSDqTJ7bLD69qtRzn3BzzLu95exgJWxTUUTexdsVv5MFu46RoxrPxF1ZpXE')
      };
    };

    it('should instantiate correctly with valid data, including signature', () => {
      const instance = new VCredStructType(testDataSig());
      expect(instance).toBeInstanceOf(VCredStructType);
      expect(instance.toFields()).toEqual(
        expect.arrayContaining([expect.any(Field)])
      );
    });

    it('should have a valid schema including signature', () => {
      expect(VCredStructType.dataSchema).toBeDefined();
      const validation = VCredStructType.schema.safeParse({
        id: { id: '123' },
        issuer: { pubkey: pk1s },
        issuanceDate: { unixTimestamp: '123123123' },
        expirationDate: { unixTimestamp: '223123123' },
        subject: { pubkey: pk2s },
        claims: [claim1s, claim2s],
        credentialSchemaHash: '789',
        signature: {signatureBase58: '7mX64qh7mUUn5jnWUAAg1o39xwic6vvCq9uwuVSDqTJ7bLD69qtRzn3BzzLu95exgJWxTUUTexdsVv5MFu46RoxrPxF1ZpXE'}
      });
      if(!validation.success){
        console.log(validation.error);
      }

      expect(validation.success).toBeTruthy();
    });
  });
});
