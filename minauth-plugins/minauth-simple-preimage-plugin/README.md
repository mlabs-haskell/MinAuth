# MinAuth Simple Preimage Plugin

This package contains an implementation of a very simple MinAuth plugin.
It functions as a proof-of-concept and an example of how to build a MinAuth plugin.
It uses MINA's o1js library for its zero-knowledge proof part.

## Plugin's overview

In essence the use of the plugin is equivalent to a standard hashed password approach, where server does not learn the password, but instead accepts its hash.
Additionally the server/verifier part of the plugin is configured with a set of roles/accounts/acl scopes tied to hashes and if given valid proof of knowledge of a preimage of one the hashes it confirms and informs the server about the valid assumption of the role.
The hash uses `Poseidon.hash` hashing function widely used in `o1js`.

## Configuration

```typescript

/**
 * The plugin configuration schema.
 */
export const rolesSchema = z.record(
  /** Hash preimage of which is used to authorize operations */
  z.string(),
  /** An auxilliary name for the hash - for example
   *  a name of a role in the system */
  z.string()
);

export const configurationSchema = z
  .object({
    roles: rolesSchema
  })
  .or(
    z.object({
      /** Alternatively, the "roles" can be loaded from a file */
      loadRolesFrom: z.string()
    })
  );


```

The plugin configuration is either a direct mapping of roles or a path to a file storing the mapping.

## Plugin's output revocation

The roles mapping can change over-time so previously accepted proofs can get outdated and invalid. MinAuth plugins support revocation of output.
This plugin will revoke any output that considered a hash that is no longer resolves to the same role (or is no longer present in the mapping.)
