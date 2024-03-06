import { Signature, PublicKey, UInt32, SelfProof, Field, ZkProgram, Poseidon, CircuitString, Struct } from 'o1js';

export const MAX_VCRED_SIZE = 128;

/**
   What does it mean to validate a credential or when can we know that the claim
   is based on a valid credential?

```
    export type VCred = {
      id: string;
      issuer: Issuer;
      claims: Claim[];
      credentialSchema: CredentialSchema;
      issuanceDate?: DateTime;
      expirationDate?: DateTime;
    }
```

   From this data model, we need to be able to derive data that contains the following:

```
    export class VCredStruct extends Struct({

      id: Field;
      issuer: PublicKey;

      issuanceDate: Field; // UTC timestamp
      expirationDate: Field; // UTC timestamp

      claims: Field[MAX_CLAIMS_SIZE];

      credentialSchema: Field;

      }) {}

```

    Then we need it it signed from the same public key that issued the credential.
    Then we need a zk-program that will use this data to verify that the credential is valid,
    i.e.
     - the signature is valid
     - the credential within validity period
    And produce two verified hashes one of the entire credential and one of the claims.
  */

/** For now, we will use a CircuitString to represent the claims. */
export const Claims = CircuitString;


export class VCredValidationContext extends Struct({
  validationTime: Field, // UTC timestamp for which the validation is being done
  signature: Signature, // The signature of the credential
  verificationKeyHash: Field // The hash of the zk program that will be used to verify the credential
}) {}

export class VCredStruct extends Struct({

  id: Field,
  issuer: PublicKey,

  issuanceDate: Field, // UTC timestamp
  expirationDate: Field, // UTC timestamp

  claims: Claims,

  credentialSchema: Field,

  }) {

  public toFields() {
    let fields = [
      this.id,
      ...this.issuer.toFields(),
      this.issuanceDate,
      this.expirationDate,
      this.claims,
      this.credentialSchema
    ];
    return fields;
  }

}

export class VCredValidationOutput extends Struct({
  credentialHash: Field,
  claimsHash: Field,
}) {};

export const ValidateVCredProgram = ZkProgram({
  name: 'ValidateVCred',
  publicInput: VCredValidationContext,
  publicOutput: VCredValidationOutput,
  methods: {
    validate: {
      privateInputs: [VCredStruct],
      method(publicInput: VCredValidationContext, cred: VCredStruct): VCredValidationOutput {
        // Check the signature
        publicInput.signature.verify(cred.issuer, cred.toFields());
        // Check the validity period
        publicInput.validationTime.assertLessThanOrEqual(cred.expirationDate);
        publicInput.validationTime.assertGreaterThanOrEqual(cred.issuanceDate);
        // Produce the hashes
        return new VCredValidationOutput({
          credentialHash: Poseidon.hash(cred.toFields()),
          claimsHash: Poseidon.hash(cred.claims.toFields())
        });
      }
    }
  }
});
export const P1 = ZkProgram({
  name: 'P1',
  publicInput: Field,
  methods: {
    someMethod: {
      privateInputs: [],
      method(publicInput: Field) {
        return publicInput;
      }
    }
  }
});

export const FakeP1 = ZkProgram({
  name: 'P1',
  publicInput: Field,
  methods: {
    someMethod: {
      privateInputs: [],
      method(publicInput: Field) {
        return new Field("10101");
      }
    }
  }
});

export const VerifyProgram = ZkProgram({
  name: 'VerifyProgram',
  publicInput: Field,
  methods: {
    verifyP1: {
      privateInputs: [SelfProof],
      method(publicInput: Field, secretInput: SelfProof<Field, void>) {
        secretInput.verify();
      }
    },
    someMethod: {
      privateInputs: [],
      method(publicInput: Field) {
        return publicInput;
      }
    }
  }
});

export const FakeValidateVCredProgram = ZkProgram({
  name: 'ValidateVCred',
  publicInput: VCredValidationContext,
  publicOutput: VCredValidationOutput,
  methods: {
    validate: {
      privateInputs: [VCredStruct],
      method(publicInput: VCredValidationContext, cred: VCredStruct): VCredValidationOutput {
        // Check the signature
        publicInput.signature.verify(cred.issuer, cred.toFields());
        // Check the validity period
        publicInput.validationTime.assertLessThanOrEqual(cred.expirationDate);
        publicInput.validationTime.assertGreaterThanOrEqual(cred.issuanceDate);
        // Produce the hashes
        return new VCredValidationOutput({
          credentialHash: Poseidon.hash(cred.toFields()),
          claimsHash: Poseidon.hash(cred.claims.toFields())
        });
      }
    }
  }
});
