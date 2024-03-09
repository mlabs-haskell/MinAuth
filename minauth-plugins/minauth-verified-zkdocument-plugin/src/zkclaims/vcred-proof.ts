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
  CircuitString
} from 'o1js';

/**
 * Represents the claims as a CircuitString.
 * It's like Field[128] but has necessary interfaces for the circuit.
 */
export class Claims extends Struct({
  claims: CircuitString
}) {
  public toFields() {
    return this.claims.toFields();
  }
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
 * Represents a Verifiable Credential (VCred) with its associated data.
 */
export class VCredStruct extends Struct({
  id: Field,
  issuer: Issuer,
  issuanceDate: Field, // UTC timestamp
  expirationDate: Field, // UTC timestamp
  claims: Claims,
  credentialSchema: CredentialSchemaHash,
  signature: Signature
}) {
  // without the signature - for the signature verification
  public contentToFields() {
    return [
      this.id,
      ...this.issuer.toFields(),
      this.issuanceDate,
      this.expirationDate,
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
  // Hash combining hasshes of the issuer's public key and the credential schema.
  identificationHash: Field,
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
        const identificationHash = Poseidon.hash([
          Poseidon.hash(cred.issuer.toFields()),
          Poseidon.hash(cred.credentialSchema.toFields())
        ]);

        return new VCredValidationOutput({
          identificationHash,
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
