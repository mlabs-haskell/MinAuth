/** @module VCredProof

This module contains the data model and zk-programs for creating and verifing
circuit compatible Verifiable Credentials (VCreds).

 */
import {
  Signature,
  PublicKey,
  Field,
  ZkProgram,
  Poseidon,
  Struct,
  CircuitString,
  UInt32,
} from 'o1js';
import { __decorate, __metadata } from "tslib";
import { PackedUInt32Factory } from 'o1js-pack';

export class IxRange extends Field {
  public get first(): number {
    return Number(PackedUInt32Factory().unpack(this)[0].toBigint());
  }
  public get last(): number {
    return Number(PackedUInt32Factory().unpack(this)[1].toBigint());
  }

  static fromNumbers(first: number, last: number): IxRange {
    return new IxRange(PackedUInt32Factory().pack([new UInt32(first), new UInt32(last)]));
  }
}

// export class Fields extends CircuitValue {
//   static maxLength = CircuitString.maxLength;

//   constructor(fields: Field[]) {
//     super(fields);
//   }

//   slice(ixRange: IxRange): Field[] {
//     const first = ixRange.first;
//     const last = ixRange.last;
//     return new Fields(this.values.slice(first, last + 1));
//   }


// }

// __decorate([
//     arrayProp(Field, CircuitString.maxLength),
//     __metadata("design:type", Array)
// ], CircuitString.prototype, "values", void 0);

/**
 * Represents indices to a set of claims along with a subject
 * against which they are made.
 */
export class CredClaimSubject extends Struct({
  pubKey: PublicKey,
  claimsRange: IxRange
}) {
  public toFields() {
    return this.pubKey.toFields().concat(this.claimsRange.toFields());
  }

  static fromFields(fields: Field[]): CredClaimSubject {
    return new CredClaimSubject({
      pubKey: new PublicKey(fields.slice(0, 2)),
      claimsRange: new IxRange(fields.slice(2, 3)[0])
    });

}

  static createCredClaimSubjectsArray(fields: Field[]): CredClaimSubject[] {
    // Check if the length of the fields array is divisible by 3
    if (fields.length % 3 !== 0) {
      throw new Error('The array length must be divisible by 3.');
    }

    const credClaimSubjects: CredClaimSubject[] = [];
    // Iterate over the fields array in steps of 3
    for (let i = 0; i < fields.length; i += 3) {
      // Extract fields for a single CredClaimSubject
      const pubKeyFields = fields.slice(i, i + 2);
      const claimRangeField = fields[i + 2];

      // Create a new CredClaimSubject instance and add it to the result array
      const credClaimSubject = new CredClaimSubject({
        pubKey: new PublicKey(pubKeyFields),
        claimsRange: new IxRange(claimRangeField)
      });

      credClaimSubjects.push(credClaimSubject);
    }

    return credClaimSubjects;
  }
}

/**
 * Represents the claims as a CircuitString (is it feasible?)
 * It's like Field[128] but has necessary interfaces for the circuit.
 */
export class Claims extends Struct({
  // indices[i] : IxRange - the indices of the ith claims
  indices: CircuitString,
  // claims - the actual data indexed by the indices
  // first field of the claim is the index of the pubkey
  claims: CircuitString,
  // in reality it's an array of `CredClaimSubject`s
  subjects: CircuitString
}) {
  public toFields() {
    return this.claims.toFields();
  }

  // static fromRecord(record: Map<PublicKey, [[Field]]>): Claims {
  //   // Initialize arrays to hold indices and claim data.
  //   let indicesArray: Field[] = [];
  //   let claimsArray: Field[] = [];
  //   let subjectsArray: Field[] = [];

  //   let claimIndex = 0; // To track the index of the claim.

  //   // Iterate over the record entries.
  //   record.forEach((claims, pubKey) => {

  //     const firstSubjectClaimIndex = claimIndex;

  //     // Iterate over the claims associated with the public key.
  //     claims.forEach((claimFields) => {
  //       // Calculate the indices for this claim.
  //       const firstIndex = claimIndex;
  //       const lastIndex = claimIndex + claimFields.length - 1;

  //       const indices: IxRange = IxRange.fromNumbers(firstIndex, lastIndex);

  //       // Update the index for the next claim.
  //       claimIndex = lastIndex + 1;

  //       // Add the indices to the indices array.
  //       indicesArray.push(indices);

  //       // Add the claim fields to the claims array.
  //       claimsArray = claimsArray.concat(claimFields);

  //     });

  //     // Add the subject to the subjects array.
  //     const subject = new CredClaimSubject({
  //       pubKey: pubKey,
  //       claimsRange: IxRange.fromNumbers(firstSubjectClaimIndex, claimIndex - 1)
  //     });

  //     subjectsArray = subjectsArray.concat(subject.toFields());
  //   });


  //   // Return the new Claims instance.
  //   return new Claims({
  //     indices: CircuitString.fromFields(indicesArray),
  //     claims: claimsCircuitString,
  //     subjects: subjectsCircuitString
  //   });
  // }
}

/**
 * Represents an issuer with a public key. Future versions might replace this
 * with a more complex ID system, such as DIDs.
 */
export class Issuer extends Struct({
  pubkey: PublicKey
}) {
  public toFields() {
    return this.pubkey.toFields();
  }
}

/**
 * Represents a unique identifier for a credential schema.
 */
export class CredentialSchemaHash extends Struct({
  credId: Field
}) {
  public toFields() {
    return [this.credId];
  }
}

/**
 * Represents a unique identifier for a credential schema.
 */
export class CredTypeId extends Struct({
  credTypeId: Field
}) {
  public toFields() {
    return [this.credTypeId];
  }

  static fromCredInfo({credentialSchema, issuerPubkey } : {credentialSchema: Field[], issuerPubkey: PublicKey} ): CredTypeId {
    return new CredTypeId({
      credTypeId: Poseidon.hash([...credentialSchema, ...issuerPubkey.toFields()])
    });
  }
}

/**
 * Represents a Verifiable Credential (VCred) with its associated data.
 */
export class VCredStruct extends Struct({
  id: Field,
  issuer: Issuer,
  issuanceDate: Field, // UTC timestamp
  expirationDate: Field, // UTC timestamp
  subject: PublicKey,
  claims: Claims,
  credentialSchema: Field,
  signature: Signature
}) {
  // without the signature - for the signature verification
  public contentToFields() {
    return [
      this.id,
      ...this.issuer.toFields(),
      this.issuanceDate,
      this.expirationDate,
      ...this.subject.toFields(),
      ...this.claims.toFields(),
      ...this.credentialSchema.toFields()
    ];
  }

  public toFields() {
    return [...this.contentToFields(), ...this.signature.toFields()];
  }
}

/**
 * Context for VCred validation, defining the valid timeframe.
 * The fields are UTC Unix timestamps.
 */
export class VCredValidationContext extends Struct({
  validFrom: Field,
  validTo: Field
}) {}

/**
 * Output of the VCred validation process.
 * In order to make sense of the credential proof, you have to be able to guess
 * the issuer and the credential schema.
 * Additionally to further assert the validity of any of the credential's claims
 * you have to know the salt used to create the claims hash.
 */
export class VCredValidationOutput extends Struct({
  // Hash combining the issuer's public key and the credential schema.
  schemaIdentificationHash: Field,
  // Salted hash of the credential's claims. No attacks possible against simple claims "{age: 18}".
  saltedClaimsHash: Field
}) {}

/**
 * ZkProgram for validating Verifiable Credentials (VCreds).

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
          signature: Signature;
        }
    ```

   From this data model, we need to be able to derive data that contains the following:

    ```
    export class VCredStruct extends Struct({
      id: Field,

      credentialSchema: CredentialSchemaHash,
      claims: Claims,

      issuanceDate: Field, // UTC timestamp
      expirationDate: Field, // UTC timestamp

      issuer: Issuer,
      signature: Signature
    }) {

    Then we need a zk-program that will use this data to verify that the credential is valid,
    i.e.
     - The signature must be valid and made with a private key matching `issuer` public key.
     - The credential is valid withing a given validity period.
    The zk program does not reveal any information about the credential, but it produces two verified hashes:
     - First for veryfing the credential's identification ( issuer x credential schema)
     - Second for verifying the credential's claims.
  */
export const ValidateVCredProgram = ZkProgram({
  name: 'ValidateVCred',
  publicInput: VCredValidationContext,
  publicOutput: VCredValidationOutput,
  methods: {
    validate: {
      privateInputs: [VCredStruct, Field],
      method(
        publicInput: VCredValidationContext,
        cred: VCredStruct,
        claimsSalt: Field
      ): VCredValidationOutput {
        // Verify the credential's signature.
        cred.signature.verify(cred.issuer.pubkey, cred.contentToFields());

        // Ensure the credential is within the validity period.
        publicInput.validFrom.assertGreaterThanOrEqual(
          cred.issuanceDate,
          "Valid from date cannot be set before the credential's issuance date."
        );
        publicInput.validTo.assertLessThanOrEqual(
          cred.expirationDate,
          "Valid to date cannot be set after the credential's expiration date."
        );

        // Calculate hashes for credential identification and claims verification.
        const schemaIdentificationHash = Poseidon.hash([
          ...cred.issuer.toFields(),
          ...cred.credentialSchema.toFields()
        ]);

        return new VCredValidationOutput({
          schemaIdentificationHash,
          saltedClaimsHash: Poseidon.hash([
            ...cred.claims.toFields(),
            claimsSalt
          ])
        });
      }
    }
  }
});

export class ValidateVCredProof extends ZkProgram.Proof(ValidateVCredProgram) {}
