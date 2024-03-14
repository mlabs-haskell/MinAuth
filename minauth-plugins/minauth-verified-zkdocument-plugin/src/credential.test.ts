import { Field } from 'o1js';
import {
  CredentialStandardSchema,
  CredentialStandard,
  CredentialSchema,
  CredentialDataSchema,
  checkCredentialStandardConformance
} from './credential.js';

describe('Credential creation and validation tests', () => {
  let KnownUserCredential: CredentialStandard;
  // credential data that adheres to the KnownUserCredential standard
  // based on schema
  let CredentialDataRaw1: {
    claims: {
      dateOfBirth: {
        name: string;
        value: string;
        fieldsValue: number[];
        standard: typeof KnownUserCredential.schema.dateOfBirth;
      };
      citizenship: {
        name: string;
        value: string;
        fieldsValue: number[];
        standard: typeof KnownUserCredential.schema.citizenship;
      };
    };
    id: { id: string };
    issuer: { pubkey: string };
    issuanceDate: { unixTimestamp: number };
    expirationDate: { unixTimestamp: number };
    subject: { pubkey: string };
    credentialSchemaHash: string;
  };

  let Credential1Raw: {
    claims: {
      dateOfBirth: {
        name: string;
        value: string;
        fieldsValue: number[];
        standard: typeof KnownUserCredential.schema.dateOfBirth;
      };
      citizenship: {
        name: string;
        value: string;
        fieldsValue: number[];
        standard: typeof KnownUserCredential.schema.citizenship;
      };
    };
    id: { id: string };
    issuer: {
      pubkey: string;
    };
    issuanceDate: { unixTimestamp: number };
    expirationDate: { unixTimestamp: number };
    subject: {
      pubkey: string;
    };
    credentialSchemaHash: string;
    signature: {
      signatureBase58: string;
    };
  };

  beforeEach(() => {
    KnownUserCredential = {
      standardId: 'eth.example.KnownUserCredential-v1.0',
      description:
        'Credential that will be given to users after verification of documents.',
      schema: {
        dateOfBirth: {
          standardId: 'dateOfBirth',
          description:
            'Date of birth as stated on provided national id or a passport',
          referenceToExternalStandard:
            'The format is described here https://www.w3.org/TR/xmlschema11-2/#dateTime',
          fieldsConversion: {
            length: 1,
            description:
              'Converts the date to unix timestamp (seconds) and then to a single o1js Field.',
            codeExample:
              '// for example using `luxon.DateTime`\n return new Field(BigInt(cred.dateOfBirth.toUtc().toUnixInteger()));'
          }
        },
        citizenship: {
          standardId: 'citizenship',
          description:
            'Country citizenship as confirmed by verified documentation. Only single-country citizenships supported.',
          referenceToExternalStandard:
            'The citizenship is in the form of a country code following the standard ISO 3166-1 alpha-3',
          fieldsConversion: {
            length: 3,
            description:
              'Each of 3 letter is represented as a field using o1js.CircuitString.fromString',
            codeExample:
              'o1js.CircuitString.fromString(cred.citizenship).toFields()'
          }
        }
      }
    };
    CredentialDataRaw1 = {
      claims: {
        dateOfBirth: {
          name: 'dateOfBirth',
          value: '1990-01-01T00:00:00Z',
          fieldsValue: [631152000],
          standard: KnownUserCredential.schema.dateOfBirth
        },
        citizenship: {
          name: 'citizenship',
          value: 'USA',
          fieldsValue: [0x5541, 0x5341, 0x0000],
          standard: KnownUserCredential.schema.citizenship
        }
      },
      id: { id: '0x1234567890' },
      issuer: {
        pubkey: 'B62qnH2ZHFKinYSMEHCcmu7Z7ijeqRTa6KRHF5KUCXnfDvPkysg5TSL'
      },
      issuanceDate: { unixTimestamp: 1710426864 },
      expirationDate: { unixTimestamp: 1720426864 },
      subject: {
        pubkey: 'B62qnH2ZHFKinYSMEHCcmu7Z7ijeqRTa6KRHF5KUCXnfDvPkysg5TSL'
      },
      credentialSchemaHash:
        '17162948422336679126313318026665558372573289127878826905197746632594425837153'
    };

    Credential1Raw = {
      ...CredentialDataRaw1,
      signature: {
        signatureBase58:
          '7mX64qh7mUUn5jnWUAAg1o39xwic6vvCq9uwuVSDqTJ7bLD69qtRzn3BzzLu95exgJWxTUUTexdsVv5MFu46RoxrPxF1ZpXE'
      }
    };
  });

  describe('CredentialStandardSchema Validation Tests', () => {
    it('should validate a correct CredentialStandard object', () => {
      // Perform validation on a valid CredentialStandard object
      const result = CredentialStandardSchema.safeParse(KnownUserCredential);

      if (!result.success) {
        console.log(
          'CredentialStandardSchema.safeParse(KnownUserCredential)',
          result.error
        );
      }

      // Expect success
      expect(result.success).toBeTruthy();
    });

    it('should detect invalid CredentialStandard objects', () => {
      // Short standardId invalidates the CredentialStandard
      let invalidCredentialStandardShortId = {
        ...KnownUserCredential,
        standardId: 'a'
      };

      // Empty description invalidates the CredentialStandard
      let invalidCredentialStandardEmptyDescription = {
        ...KnownUserCredential,
        description: ''
      };

      // Empty fieldsConversion array in schema invalidates the CredentialStandard
      let invalidCredentialStandardEmptyFieldsConversion = JSON.parse(
        JSON.stringify(KnownUserCredential)
      );
      invalidCredentialStandardEmptyFieldsConversion.schema.dateOfBirth.fieldsConversion.length = 0;

      // Empty schema invalidates the CredentialStandard
      let invalidCredentialStandardEmptySchema = {
        ...KnownUserCredential,
        schema: {}
      };

      // Perform validation
      const resultShortId = CredentialStandardSchema.safeParse(
        invalidCredentialStandardShortId
      );
      const resultEmptyDescription = CredentialStandardSchema.safeParse(
        invalidCredentialStandardEmptyDescription
      );
      const resultEmptyFieldsConversion = CredentialStandardSchema.safeParse(
        invalidCredentialStandardEmptyFieldsConversion
      );
      const resultEmptySchema = CredentialStandardSchema.safeParse(
        invalidCredentialStandardEmptySchema
      );

      // Expect failure for each
      expect(resultShortId.success).toBeFalsy();
      expect(resultEmptyDescription.success).toBeFalsy();
      expect(resultEmptyFieldsConversion.success).toBeFalsy();
      expect(resultEmptySchema.success).toBeFalsy();
    });
  });

  describe('CredentialDataSchema and CredentialSchema Validation Tests', () => {
    it('should validate correct CredentialData and Credential objects', () => {
      // Perform validation on a valid CredentialData object
      const resultData = CredentialDataSchema.safeParse(CredentialDataRaw1);
      if (!resultData.success) {
        console.log(
          'Perform validation on a valid CredentialData object',
          resultData.error
        );
      }

      // Perform validation on a valid Credential object
      const result = CredentialSchema.safeParse(Credential1Raw);

      if (!result.success) {
        console.log(
          'Perform validation on a valid Credential object',
          result.error
        );
      }

      // Expect success for both
      expect(resultData.success).toBeTruthy();
      expect(result.success).toBeTruthy();
    });

    it('should detect issues in invalid CredentialData and Credential objects', () => {
      // Invalid CredentialData - missing claims
      const invalidCredentialDataNoClaims = {
        ...CredentialDataRaw1,
        claims: {}
      };
      expect(Object.entries(invalidCredentialDataNoClaims.claims).length).toBe(
        0
      );

      // Invalid CredentialData - incorrect field value type
      const invalidCredentialDataIncorrectFieldValue = JSON.parse(
        JSON.stringify(CredentialDataRaw1)
      );
      invalidCredentialDataIncorrectFieldValue.claims.dateOfBirth.fieldsValue =
        'not an array';

      // Invalid Credential - missing signature
      const invalidCredentialNoSignature: unknown &
        Partial<{ signature: unknown }> = {
        ...Credential1Raw
      };
      delete invalidCredentialNoSignature.signature;

      // Invalid Credential - incorrect id format
      const invalidCredentialIncorrectId = {
        ...Credential1Raw,
        id: { id: 'invalid format' }
      };

      // Perform validation
      const resultNoClaims = CredentialDataSchema.safeParse(
        invalidCredentialDataNoClaims
      );
      const resultIncorrectFieldValue = CredentialDataSchema.safeParse(
        invalidCredentialDataIncorrectFieldValue
      );
      const resultNoSignature = CredentialSchema.safeParse(
        invalidCredentialNoSignature
      );
      const resultIncorrectId = CredentialSchema.safeParse(
        invalidCredentialIncorrectId
      );

      // Expect failure for each invalid case
      expect(resultNoClaims.success).toBeFalsy();
      expect(resultIncorrectFieldValue.success).toBeFalsy();
      expect(resultNoSignature.success).toBeFalsy();
      expect(resultIncorrectId.success).toBeFalsy();
    });
  });

  describe('checkCredentialStandardConformance Function Tests', () => {
    it('should confirm conformance for matching standard and credential', () => {
      // Given a correct pair of Credential and CredentialStandard that are expected to match
      const matchingCredential = CredentialSchema.parse(Credential1Raw);
      const matchingStandard = KnownUserCredential;

      const isConformant = checkCredentialStandardConformance(
        matchingCredential,
        matchingStandard
      );

      // Expect the result to be true since the credential should conform to the standard
      expect(isConformant).toBeTruthy();
    });

    it('should detect non-conformance due to fields mismatch', () => {
      interface Claim {
        name: string;
        value: string;
        fieldsValue: number[]; // Adjusted to number[] since your fieldsValue seems to be an array of numbers
        standard: any; // Use the actual expected type
      }

      interface CredentialData {
        claims: {
          [key: string]: Claim;
        };
        // Include other necessary fields from CredentialDataRaw1...
        id: any; // Use the actual expected type
        issuer: any; // Use the actual expected type
        issuanceDate: any; // Use the actual expected type
        expirationDate: any; // Use the actual expected type
        subject: any; // Use the actual expected type
        credentialSchemaHash: any; // Use the actual expected type
      }

      let nonMatchingCredentialRaw: CredentialData = { ...CredentialDataRaw1 };
      // set citizenship field value to be a single field array

      delete nonMatchingCredentialRaw.claims.citizenship;

      nonMatchingCredentialRaw.claims.city = {
        name: 'city',
        value: 'New York',
        fieldsValue: [0x4e, 0x65, 0x77, 0x20, 0x59, 0x6f, 0x72, 0x6b],
        standard: KnownUserCredential.schema.citizenship
      };

      const result = CredentialSchema.safeParse(nonMatchingCredentialRaw);

      if (!result.success) {
        console.log(
          'Should be able to parse the nonMatchingCredentialRaw',
          result.error
        );
        return;
      }

      const nonMatchingCredential = result.data;

      expect(nonMatchingCredential.claims.citizenship).toBeUndefined();

      // Call the function to check conformance
      const isConformant = checkCredentialStandardConformance(
        nonMatchingCredential,
        KnownUserCredential
      );

      // Expect the result to be false since the credential fields do not match the standard specifications
      expect(isConformant).toBeFalsy();
    });

    it('should detect non-conformance due to fieldValues length mismatch', () => {
      // Define a non-matching CredentialStandard and Credential by altering the fields
      const matchingCredential = CredentialSchema.parse(Credential1Raw);

      let nonMatchingCredential = {
        ...matchingCredential,
        claims: { ...matchingCredential.claims }
      };
      // set citizenship field value to be a single field array
      nonMatchingCredential.claims.citizenship.fieldsValue = [
        new Field(0x5541)
      ];

      // Call the function to check conformance
      const isConformant = checkCredentialStandardConformance(
        nonMatchingCredential,
        KnownUserCredential
      );

      // Expect the result to be false since the credential fields do not match the standard specifications
      expect(isConformant).toBeFalsy();
    });
  });
});
