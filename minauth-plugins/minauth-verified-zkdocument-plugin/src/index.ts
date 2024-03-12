import { Field, PrivateKey, Provable, PublicKey, Signature, Struct, verify } from 'o1js';
import { Logger } from 'tslog';
import { z } from 'zod';
import * as Simple from './data/simple.js';
import * as Ids from './data/ids.js';
import { IxRange } from './zkclaims/vcred-proof.js';

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

log.info('Creating a new credential schema');


log.info('Registering the new credential schema');

log.info('Issuing a credential');

log.info('Delivering the credential to the holder ');

log.info('  1. simplest way possible');

log.info('  2. (maybe later) on valid pkey proof ');

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

const p = PrivateKey.random();

const pk = p.toPublicKey();

const pkf = pk.toFields();

console.log(pkf.length);
