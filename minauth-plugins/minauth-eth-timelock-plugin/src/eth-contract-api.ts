import { ethers } from 'ethers';
import contractABI from './eth-contract-abis/ERC721TimeLock.json'; // Import ABI from a local file
import { z } from 'zod';
import { Logger, ILogObj } from 'tslog';

const ContractConfigurationSchema = z.object({
  contractAddress: z.string(),
  providerUrl: z.string(),
  privateKey: z.string().optional()
});

export type ContractConfiguration = z.infer<typeof ContractConfigurationSchema>;

// Define the structure of a locked token using Zod
const lockedTokenSchema = z.object({
  user: z.string(), // The address of the user who locked the token
  tokenAddress: z.string(), // The address of the ERC721 token contract
  tokenId: z.number(), // The ID of the token
  unlockTime: z.number(), // The timestamp when the token will be unlocked
  hash: z.string() // The hash associated with the locked token
});

// This will infer the TypeScript type from the Zod schema
type LockedToken = z.infer<typeof lockedTokenSchema>;

class ERC721TimeLockContract {
  private contract: ethers.Contract;
  private signer?: ethers.Wallet;

  constructor(
    private config: ContractConfiguration,
    private log?: Logger<ILogObj>
  ) {
    const provider = new ethers.providers.JsonRpcProvider(config.providerUrl);

    // If a private key is provided, create a signer
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, provider);
      this.contract = new ethers.Contract(
        config.contractAddress,
        contractABI,
        this.signer
      );
    } else {
      // Otherwise, use the provider directly (read-only)
      this.contract = new ethers.Contract(
        config.contractAddress,
        contractABI,
        provider
      );
    }
  }

  // Function to lock an NFT
  async lockToken(
    tokenAddress: string,
    tokenId: number,
    lockPeriod: number,
    hash: string
  ): Promise<ethers.ContractTransaction> {
    if (!this.signer) {
      throw new Error('Signer not initialized. User must be logged in.');
    }

    // Ensure the lock period and hash are valid
    if (lockPeriod <= 0) {
      throw new Error('Lock period must be greater than 0');
    }

    if (!ethers.utils.isHexString(hash) || hash.length !== 66) {
      // 66 characters for a 32-byte hash with '0x' prefix
      throw new Error(
        'Invalid hash. Hash must be a valid 32 bytes hex string.'
      );
    }

    // Call the lockToken function of the smart contract
    return this.contract.lockToken(tokenAddress, tokenId, lockPeriod, hash);
  }

  /**
   * Unlocks a previously locked NFT.
   *
   * This function sends a transaction to the smart contract to unlock a specific NFT
   * identified by its index in the locked tokens array of the user.
   *
   * @param {number} index - The index of the locked token in the user's array of locked tokens.
   * @returns {Promise<ethers.ContractTransaction>} A promise that resolves to the transaction object.
   *
   * @throws {Error} Throws an error if the signer is not initialized or if the index is invalid.
   */
  async unlockToken(index: number): Promise<ethers.ContractTransaction> {
    if (!this.signer) {
      throw new Error('Signer not initialized. User must be logged in.');
    }

    // Ensure the index is valid
    if (index < 0) {
      throw new Error('Invalid index. Index must be a non-negative number.');
    }

    // Call the unlockToken function of the smart contract
    return this.contract.unlockToken(index);
  }

  /**
   * Retrieves and computes valid locked token entries using a functional approach.
   *
   * This function listens for TokenLocked and TokenUnlocked events,
   * processes them, and returns a list of entries that represent tokens
   * that are still locked.
   *
   * @returns {Promise<LockedToken[]>} A promise that resolves to an array of valid locked tokens.
   */
  async getValidLockedTokens(): Promise<LockedToken[]> {
    // Define filters for the events
    const filterTokenLocked = this.contract.filters.TokenLocked();
    const filterTokenUnlocked = this.contract.filters.TokenUnlocked();

    // Retrieve the events
    const eventsLocked = await this.contract.queryFilter(filterTokenLocked);
    const eventsUnlocked = await this.contract.queryFilter(filterTokenUnlocked);

    // Process TokenLocked events and validate the data
    const lockedTokens = eventsLocked
      .map((event) => ({
        user: event.args.user,
        tokenAddress: event.args.tokenAddress,
        tokenId: event.args.tokenId.toNumber(),
        unlockTime: event.args.unlockTime.toNumber(),
        hash: event.args.hash
      }))
      .filter(lockedTokenSchema.safeParse)
      .map((validEvent) => validEvent.data);

    // Create a set of unique identifiers for unlocked tokens
    const unlockedTokens = new Set(
      eventsUnlocked.map(
        (event) =>
          `${event.args.user}-${
            event.args.tokenAddress
          }-${event.args.tokenId.toNumber()}`
      )
    );

    // Filter out tokens that have been unlocked
    const stillLocked = lockedTokens.filter((token) => {
      const tokenIdentifier = `${token.user}-${token.tokenAddress}-${token.tokenId}`;
      return !unlockedTokens.has(tokenIdentifier);
    });

    return stillLocked;
  }

  // Additional methods to interact with the contract will go here
}

// ----------------------------------------------------------------------
// Example usage
const test = async () => {
  const log = new Logger<ILogObj>({ name: 'ERC721TimeLock tests' });
  const contractAddress = 'YOUR_CONTRACT_ADDRESS';
  const providerUrl = 'YOUR_PROVIDER_URL';
  const privateKey = 'YOUR_PRIVATE_KEY'; // Optional, only for write operations

  const erc721TimeLock = new ERC721TimeLockContract({
    contractAddress,
    providerUrl,
    privateKey
  });
  // Example usage
  // Assume erc721TimeLock is an instance of ERC721TimeLockContract and is already initialized

  const tokenAddress = '0x...'; // ERC721 token contract address
  const tokenId = 123; // Token ID to be locked
  const lockPeriod = 60 * 60 * 24; // Lock period in seconds, e.g., 1 day
  const hash = '0x1234...'; // A 32-byte hash, represented as a hex string

  erc721TimeLock
    .lockToken(tokenAddress, tokenId, lockPeriod, hash)
    .then((transaction) => {
      log.info('Transaction sent:', transaction.hash);
      // Handle transaction sent
    })
    .catch((error) => {
      log.error('Error locking token:', error);
      // Handle errors
    });

  // Now you can use erc721TimeLock to interact with your smart contract

  const index = 0; // Index of the locked token to be unlocked

  erc721TimeLock
    .unlockToken(index)
    .then((transaction) => {
      log.info('Transaction sent:', transaction.hash);
      // Handle transaction sent
    })
    .catch((error) => {
      log.error('Error unlocking token:', error);
      // Handle errors
    });
};
