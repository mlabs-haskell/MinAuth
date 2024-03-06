# TODO

- more spec on the structure of claims, verifiable credentials, transformation into verifiable presentations.
- then credentials specs and the registry
- maybe add some diagrams



# MinAuth Verified ZK-Document Plugin

🚧 **DISCLAIMER**: The plugin & the documentation under development.

This package contains an implementation of a MinAuth plugin.
It uses MINA's o1js library for its zero-knowledge proof part.

The plugin allows to use zk cryptographically secure proofs of claims
on the zk-documents to be used as a source of authentication.

## Simplified conceptual overview

Plugin allows to assume one of roles: verifier, holder(prover), issuer.
The issuer issues claims on some subject (usually the holder). Sets of claims form 'credentials'.
Such credentials can then be passed to a credential holder. The credential holder may transform
them into 'presentations' in a way that verifiably preserve validity of the credentials.
The transformation involve deriving information from the credentials using ZK-proofs.
For example one can derive "age over 18" from a passport document issued by a nation state.
Then by providing them to 'verifiers' can get authorization in systems guarded by the verifiers.
There are some desirable characteristics that this plugin should have that are described below.

## Verifiable Credentials W3C Standard Context

The plugin will make use of or be inspired by the standards developed by W3C
on Verifiable Credentials.
The goal is to make design decisions that will be more easily portable to
more complex systems that are compatible with those standards and also to re-use
the conceptual work done on the development on those standards given the same end
goals that the projects share.
In particular (https://www.w3.org/TR/vc-data-model/)[Verifiable Credentials Data Model v1.1]
will be cited here for many system parts.

### Basic concepts / Vocabulary

 - user agent - An entity that acts in the system on the behalf of a user performing one of the system roles (issuer, holder, verifier)
 - claim - An assertion made about a subject.
 - credential - A set of one or more claims made by an issuer.
 - verifiable credential - a tamper-evident credential that has authorship that can be cryptographically verified.
 - holder - A role an entity might perform by possessing one or more verifiable credentials and generating presentations from them. A holder is usually, but not always, a subject of the verifiable credentials they are holding. Holders store their credentials in credential repositories.
 - issuer - A role an entity can perform by asserting claims about one or more subjects, creating a verifiable credential from these claims, and transmitting the verifiable credential to a holder.
 - presentation - Data derived from one or more verifiable credentials, issued by one or more issuers, that is shared with a specific verifier.
 - verifiable presentation - A tamper-evident presentation encoded in such a way that authorship of the data can be trusted after a process of cryptographic verification. Certain types of verifiable presentations might contain data that is synthesized from, but do not contain, the original verifiable credentials (for example, zero-knowledge proofs).
 - subject - A thing about which claims are made.
 - verifier - A role an entity performs by receiving one or more verifiable credentials, optionally inside a verifiable presentation for processing.
 - verifiable data registry - A role a system might perform by mediating the creation and verification of identifiers, keys, and other relevant data, such as verifiable credential schemas, revocation registries, issuer public keys, and so on, which might be required to use verifiable credentials.

### Desirable characteristics

 - Acting as issuer, holder, or verifier requires neither registration nor approval by any authority, as the trust involved is bilateral between parties.
 - Issuers can issue verifiable credentials about any subject.
 - Holders can receive verifiable credentials from anyone.
 - Verifiable presentations allow any verifier to verify the authenticity of verifiable credentials from any issuer.
 - Holders can interact with any issuer and any verifier through any user agent.
 - Holders can share verifiable presentations, which can then be verified without revealing the identity of the verifier to the issuer.
 - Holders can store verifiable credentials in any location, without affecting their verifiability and without the issuer knowing anything about where they are stored or when they are accessed.
 - Holders can present verifiable presentations to any verifier without affecting authenticity of the claims and without revealing that action to the issuer.
 - A verifier can verify verifiable presentations from any holder, containing proofs of claims from any issuer.
 - Verification should not depend on direct interactions between issuers and verifiers.
 - Verification should not reveal the identity of the verifier to any issuer.
 - Issuers can issue revocable verifiable credentials.
 - Revocation by the issuer should not reveal any identifying information about the subject, the holder, the specific verifiable credential, or the verifier.
 - Issuers can disclose the revocation reason.
 - Issuers revoking verifiable credentials should distinguish between revocation for cryptographic integrity (for example, the signing key is compromised) versus revocation for a status change (for example, the driver’s license is suspended).

## Plugin's overview

The simple example is the popular case of proving a credit score.
There are 3 entities involved:

- The verifying entity (verifier) - one that needs the proof
- The credit score issuer (3rd party / issuer) - one that approves the validity of the document
- The proving entity (prover) - one that is requested to prove the required claim.
- The verifiable data registry - additionally there is a passive 4th entity that is the legitimate source of claim standards. It, for example, could be a recognized repository with hashes pinned on-chain in a DAO-guarded contract, or publicly shared merkle map of standards.

The verifier uses one of the required 'credit score above X' claim proving programs to create
a proof against their document. The proof along the claim proving zkprogram verification key hash
and other details such as the user's private key go into the authorization verifier.

On succesful authorization the MinAuth plugin return the set of proven data to the verifying entity
to provide access to its services.

### ZK-document & zk-claims

First we assume the existence of a document type that is issued and recognized by
the 3rd party. This can be done via a signature of a trusted public key, i.e. the
verifier trusts the public key of the 3rd party. The document is malleable to a
set of claim-proving zk-programs, this can be implemented as a merkle list of
verifification_keys hashes.
The signature of the 3rd party includes the public key of the prover.

The document can then be used by the prover as input to claim proving algorithms.
The proofs coming from the algorithms are then used in the verifier final proof verifier,
which is integrated and customizable in the IMinauthPlugin intance provided by this
package.


### ZK-document standard (schema)

The issuer issuing the document additionally issues a standard to which the document adheres.
This standard describes the document and its structure (currently as a list of Fields).
So an example could be:

```
document_id                        | 0-0 |   The identifier of the document in the issuer database
document_end_of_validity_timestamp | 1-1 |   The document validity period.
subject_id                         | 2-2 |   The identifier of the subject of the new document
subject_age                        | 3-3 |   The age of the subject. Valid range is: [0-150]
subject_credit_score               | 4-4 |   The credit_score of the subject Valid range is: [0-1.000.000.000]
subject_country_of_residence       | 5-5 |   `ISO 3166-1 numeric` standard country code
```

### UI

The UI design of this plugin' prover can easily get complex enough to be a project on its
own. Given the scope and resources as of today it will need careful consideration
on how to keep it minimal.

## Implemented claim provers

In most cases users of the library will want to use their own claim provers designed
to suit there needs, but some demonstrational one are implemented as a part of the
package.

### Document valid to X (and general date claim prover)

Assuming the document being a list of Fields. Validity timestamp index is hardcoded into the claim prover.
X is a part of the public input.

### Age over X (and general number size claim prover)

Assuming the document being a list of Fields Age index is hardcoded into the claim prover.
X is a part of the public input.

### Country of residence equal to X via `ISO 3166-1 numeric` (and general string prover)

Assuming the document being a list of Fields Age index is hardcoded into the claim prover.
X is a part of the public input.

### Possible zk-claims rollups

If possible the claims will be able to be rolled up for space & server-time efficiency.
The verifier could ask for a joined claim of:

- Document valid > month from now
- Subject age > 18
- Subject residency in EU

All the claims could be rolled up into a single proof of constant size.

## Configuration

🚧 **Under construction**

## Plugin's output revocation

The claims proven about the document do not go outdated, but the documents can.
Additionally the plugin user may want to query the issuer for deprecation of their public
key or designated withdrawal of the recognition of particular documents.
