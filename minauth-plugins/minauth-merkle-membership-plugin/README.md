# MinAuth Merkle Membership Plugin

This package contains an implementation of a simple MinAuth plugin that
extends the concept of password authentication into authenticating within
sets that provide a level of anonymity.
The proofs are built and verified with  MINA's `o1js` library & proof system.

## Plugin's overview

By declaring a set of merkle tree roots and providing witnesses to their leaves,
one can prove "membership" in those sets and thus get some authority in the system.
The sets could be linked to roles in the system or to sets of authorized operations.
Additionally the plugin contains abstractions for storing the merkle trees and pinning
their roots to Mina blockchain, which can help determine the valid behaviour / authority
of the server accepting the proofs.

## Configuration

```typescript

/**
 * Schema for the configuration of a Mina trees provider.
 * If for given tree `feePayerPrivateKey` and `contractPrivateKey`
 * are not simultanously present the tree root will NOT be commited to
 * the MINA blockchain.
 */
export const minaTreesProviderConfigurationSchema = z.object({
  feePayerPrivateKey: z.string().optional(),
  trees: z.array(
    z.object({
      contractPrivateKey: z.string().optional(),
      offchainStoragePath: z.string(),
      initialLeaves: z.record(z.string()).optional()
    })
  )
});

```

*NOTE* Commiting to MINA blockchain may require additional steps such as setting the active MINA network instance and funding the account behind the generated private key, which are not covered in the code or documentation.

## Plugin's output revocation

The sets to which the 'membership' is proven may change over time.
This plugin will revoke any output for which the proof output hash no longer matches the corresponding combinate hash of merkle roots accepted by the server.
