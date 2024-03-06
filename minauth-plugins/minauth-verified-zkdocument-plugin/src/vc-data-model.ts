import { DateTime } from 'luxon';

// This is a temporary file for prototyping data models related to the Verifiable Credentials.
// It will not only contain the data model but also the methods to interact with the data model.

// json data model
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

interface JsonObject {
  [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}


type Entity = {
  publicKey: string;
}

export type Subject = Entity

export type Issuer = Entity


/**
 * A statement made by an entity about a subject.
 */
export type Claim = {
  subject: Subject;
  subjectProperty: string; // TODO: should these be somehow enumerated / registered?
  propertyValue: JsonValue;
}

export type CredentialSchema = {
  id: string;
}

/**
 * Represents a Verifiable Credential.
 */
export type VCred = {
  id: string;
  issuer: Issuer;
  claims: Claim[];
  credentialSchema: CredentialSchema;
  issuanceDate?: DateTime;
  expirationDate?: DateTime;
}
