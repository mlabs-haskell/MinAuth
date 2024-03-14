import { Logger } from 'tslog';
import { CredentialStandard } from './credential';

const log = new Logger({ name: 'index.ts prototyping' });

log.info('Happy path testing...');

log.info('========= Schemas =========');

// SimpleSchemas.inline_tests();



// /**
//  * Represents an issuer with a public key. Future versions might replace this
//  * with a more complex ID system, such as DIDs.
//  */
// export class IssuerId extends Struct({
//   pubkey: PublicKey
// }) {
//   public toFields() {
//     return this.pubkey.toFields();
//   }
// }

// const IssuerIdSchema = PublicKeyB58Schema;
// type IssuerId = z.infer<typeof IssuerIdSchema>;

log.info('Creating a new credential standard');

const KnownUserCredential: CredentialStandard = {
  standardId: "eth.example.KnownUserCredential-v1.0",
  description: "Credential that will be given to users after verification of documents.",
  schema: {
    dateOfBirth: {
      standardId: "dateOfBirth",
      description: "Date of birth as stated on provided national id or a passport",
      referenceToExternalStandard: "The format is described here https://www.w3.org/TR/xmlschema11-2/#dateTime",
      fieldsConversion: {
        length: 1,
        description: "Converts the date to unix timestamp (seconds) and then to a single o1js Field.",
        codeExample: "// for example using `luxon.DateTime`\n return new Field(BigInt(cred.dateOfBirth.toUtc().toUnixInteger()));"
      }
    },
    citizenship: {
      standardId: "citizenship",
      description: "Country citizenship as confirmed by verified documentation. Only single-country citizenships supported.",
      referenceToExternalStandard: "The citizenship is in the form of a country code following the standard ISO 3166-1 alpha-3",
      fieldsConversion: {
        length: 3,
        description: "Each of 3 letter is represented as a field using o1js.CircuitString.fromString",
        codeExample: "o1js.CircuitString.fromString(cred.citizenship).toFields()"
      }
    }
  }
}


log.info('Registering the new credential standard - later');

log.info('Issuing a credential');

log.info('1. Create credential');

log.info('2. Have it serialized');

log.info('3. Verify and sign');

log.info('4. Make it available to holder on access code.');

log.info('========= Holder / Prover =========');

log.info('Requesting a credential');

log.info('Installing in the credential store');

log.info('(later) Requesting a resource access schema');

// // for example somthing akin to:
//  [{ access: ["read"],
//   , credentials: [
//     { schemaIdentificationHash: "<hash of credential schema and issuer pubkey."
//     , claimProofDescription: [
//       { claimName: "name"
//       , publicInput "<simple value for equality check for now>"
//       } ]
//     , claimProofVerificationKeyHash: "<hash of the proof verification key>"
//     , expectedProofPublicOutput: "<simple value for equality check for now>"
//     , minValidRange: {"from", "to"}
//     , nonRevocationProof: true // (later)
//     },
//     ...
//     ]
//   },
//   { access: ["read","write"]
//   , ...
//   }
// ]
log.info('(later) searching for the proof path with resource access schema');

log.info('Building the proof as per the proof path');

log.info('Requesting access to the resource with the proof');

log.info('Disabling/deleting credential');

log.info('========= Verifier / Plugin =========');

log.info('Accessing schema registry');

log.info(
  'Assembling the config - \
  that includes a resource access schema'
);

log.info('Setting up prover routes');

log.info('Verifying proofs');

log.info('Checking outputs validity');

log.info('Revocation proofs');

log.info('');
