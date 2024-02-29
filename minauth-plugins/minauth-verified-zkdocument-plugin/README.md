# MinAuth Verified ZK-Document Plugin

🚧 **DISCLAIMER**: The plugin & the documentation under development.

This package contains an implementation of a MinAuth plugin.
It uses MINA's o1js library for its zero-knowledge proof part.

The plugin allows to use zk cryptographically secure proofs of claims
on the zk-documents to be used as a source of authentication.

## Plugin's overview

The simple example is the popular case of proving a credit score.
There are 3 entities involved:

- The verifying entity (verifier) - one that needs the proof
- The credit score issuer (3rd party / issuer) - one that approves the validity of the document
- The proving entity (prover) - one that is requested to prove the required claim.

Additionally there is a passive 4th entity that is the legitimate source of claim standards.
It could be a recognized repository with hashes pinned on-chain in a DAO-guarded contract.

The verifier uses one of the required "credit score above X" claim proving programs to create 
a proof against their document. The proof along the claim proving zkprogram verification key hash
and other details such as the user's private key go into the authorization verifier.

On succesful authorization the MinAuth plugin return the set of proven data to the verifying entity
to provide access to its services.

### ZK-document

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

### Document valid to X

Assuming the document being a list of Fields. Validity timestamp index is hardcoded into the claim prover.
X is a part of the public input.

### Age over X

Assuming the document being a list of Fields Age index is hardcoded into the claim prover.
X is a part of the public input.

### Country of residence equal to X via `ISO 3166-1 numeric`

Assuming the document being a list of Fields Age index is hardcoded into the claim prover.
X is a part of the public input.


## Configuration

🚧 **Under construction**

## Plugin's output revocation

The claims proven about the document do not go outdated, but the documents can.
Additionally the plugin user may want to query the issuer for deprecation of their public
key or designated withdrawal of the recognition of particular documents.
