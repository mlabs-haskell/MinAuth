# MinAuth ERC-721 Time-lock Plugin

This package contains an implementation of a MinAuth plugin that combines zero-knowledge Merkle "membership" proofs with the ability to register into to a Merkle tree with locking an Ethereum NFT.

## Plugin's overview

The server configures the plugin to connect to pre-deployed Ethereum contracts.
One contract is the contract of the accepted NFT family and the other is the locking contract.
The client can interact with the contracts and lock owned NFT along with a hash commitment.
Both server/verifier and client/prover access the list of commitments currently backed by the locked NFTs.
The prover build a proof of knowledge of a secret behind one of allowed commitments to get an authorization.
The server verifies the proof and checks it against the current state of the Ethereum contract.
This authorization technique may preserves a level of anonymity since no information about particular token or commitment is present within the exchanged proof. (If the Merkle tree is sufficiently large and time correlation is not obvious).

## Configuration

```typescript

/**
 * The plugin configuration schema.
 * `timeLockContractAddress` - an address to the ethereum contract handling
 * time-locking NFTs and hashes.
 * `erc721ContractAddress` - an address to the ethereum contract for NFTs
 * that configured to be used with this plugin (in future might be extended to
 * support multiple such addresses)
 * `ethereumJsonRpcProvider` - a json rpc provider for the ethereum network
 */
export const ConfigurationSchema = z.object({
  timeLockContractAddress: z.string(),
  erc721ContractAddress: z.string(),
  ethereumJsonRpcProvider: z.string()
});

```

## Plugin's output revocation

The state of the Ethereum contract is continuously monitored and the Merkle tree is rebuilt everytime it changes. Any plugin's accepted output that was created for a concrete Merkle root will not be accepted if the current root does not match.
