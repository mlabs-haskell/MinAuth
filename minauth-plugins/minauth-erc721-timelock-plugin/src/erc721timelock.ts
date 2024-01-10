import { BytesLike, ethers } from 'ethers';
import { ERC721TimeLock as ERC721TimeLockContract } from './typechain/contracts/ERC721TimeLock.js';
import { ERC721TimeLock__factory } from './typechain/factories/contracts/ERC721TimeLock__factory.js';
import { ERC721Mock__factory } from './typechain/factories/contracts/ERC721Mock__factory.js';
import { MerkleTree } from './merkle-tree.js';
import { UserCommitmentHex, commitmentHexToField } from './commitment-types.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { ERC721Mock } from './typechain/index.js';

export interface IErc721TimeLock {
  fetchEligibleCommitments(): Promise<{ commitments: UserCommitmentHex[] }>;
  buildCommitmentTree(): Promise<MerkleTree>;
  lockToken(tokenId: number, hash: UserCommitmentHex): Promise<void>;
  unlockToken(index: number): Promise<void>;

  get lockContractAddress(): string;
  get erc721ContractAddress(): string;
  get ethereumProvider(): ethers.BrowserProvider | ethers.JsonRpcProvider;
}

export class Erc721TimeLock implements IErc721TimeLock {
  protected contract: ERC721TimeLockContract;
  protected nftContract: ERC721Mock;

  constructor(
    private readonly signer: ethers.JsonRpcSigner,
    readonly lockContractAddress: string,
    readonly erc721ContractAddress: string,
    readonly ethereumProvider: ethers.BrowserProvider | ethers.JsonRpcProvider,
    private readonly logger?: Logger
  ) {
    this.contract = ERC721TimeLock__factory.connect(
      lockContractAddress,
      this.signer
    );
    this.nftContract = ERC721Mock__factory.connect(
      erc721ContractAddress,
      this.signer
    );
    this.logger?.debug('Erc721TimeLock contract:', this.contract);
  }

  static async initialize(
    addresses: { lockContractAddress: string; nftContractAddress: string },
    ethereumProvider: ethers.BrowserProvider | ethers.JsonRpcProvider,
    logger?: Logger
  ) {
    const signer = await ethereumProvider.getSigner();
    logger?.debug('Signer:', signer);

    return new Erc721TimeLock(
      signer,
      addresses.lockContractAddress,
      addresses.nftContractAddress,
      ethereumProvider,
      logger
    );
  }

  /**
   * Fetch the TokenLocked and TokenUnlocked events to get the hashes of currently locked tokens.
   */
  async fetchEligibleCommitments(): Promise<{
    commitments: UserCommitmentHex[];
  }> {
    // Fetch TokenLocked events
    const lockedFilter = this.contract.filters.TokenLocked();
    const lockedEvents = await this.contract.queryFilter(lockedFilter);

    // Fetch TokenUnlocked events
    const unlockedFilter = this.contract.filters.TokenUnlocked();
    const unlockedEvents = await this.contract.queryFilter(unlockedFilter);

    // Process events to determine currently locked tokens
    const currentlyLockedTokens = new Map<string, string>(); // Map of tokenId to hash
    for (const event of lockedEvents) {
      currentlyLockedTokens.set(event.args.tokenId.toString(), event.args.hash);
    }
    for (const event of unlockedEvents) {
      currentlyLockedTokens.delete(event.args.tokenId.toString());
    }
    const commitments = Array.from(currentlyLockedTokens.values()).map(
      (hash) => ({ commitmentHex: hash })
    );
    return { commitments };
  }

  /**
   * Locks a token by first approving its transfer and then interacting with the lock contract.
   * @param tokenId The ID of the token to be locked.
   * @param hash The hash representing the token's commitment.
   */
  async lockToken(
    tokenId: number,
    { commitmentHex }: UserCommitmentHex
  ): Promise<void> {
    // Approve the ERC721TimeLock contract to transfer the token
    try {
      const approvalTx = await this.nftContract.approve(
        this.lockContractAddress,
        tokenId
      );
      await approvalTx.wait();
    } catch (e) {
      this.logger?.error('Error approving nft transfer:', e);
      throw e;
    }

    const commitmentBytes = hexToUInt8Array(
      commitmentHex.startsWith('0x') ? commitmentHex : '0x' + commitmentHex
    );

    // Lock the token
    try {
      this.logger?.info(
        `Locking token ${tokenId} with commitment ${commitmentHex} started.`
      );
      this.logger?.debug(`Commitment bytes: ${commitmentBytes}`);

      const lockTx = await this.contract.lockToken(
        this.erc721ContractAddress,
        tokenId,
        commitmentBytes
      );
      await lockTx.wait();
    } catch (e) {
      this.logger?.error('Error locking token in timelock contract:', e);
      throw e;
    }
  }

  /**
   * Unlocks a token by interacting with the lock contract.
   * @param index The index of the token in the locked tokens array.
   */
  async unlockToken(index: number): Promise<void> {
    // Approve the ERC721TimeLock contract to transfer the token
    const unlockTx = await this.contract.unlockToken(index);
    await unlockTx.wait();
  }

  /**
   * Fetch the commitments from the events and build a merkle tree.
   */
  buildCommitmentTree = async () => {
    const { commitments } = await this.fetchEligibleCommitments();
    const merkleTree = new MerkleTree(
      commitments.map((x) => commitmentHexToField(x).commitment)
    );
    return merkleTree;
  };
}

export function hexlify(bytes: BytesLike): string {
  return ethers.hexlify(bytes);
}

export function hexToUInt8Array(hexString: string, size?: number): Uint8Array {
  // Validate the input
  if (!/^0x[a-fA-F0-9]+$/.test(hexString)) {
    throw new Error('Invalid hexadecimal string');
  }

  // Remove the '0x' prefix
  hexString = hexString.slice(2);

  const sz = size || hexString.length / 2;

  // pad with zeros
  const padding = sz * 2 - hexString.length;
  hexString = '0'.repeat(padding) + hexString;

  // Calculate the number of bytes in the hex string
  const numBytes = hexString.length / 2;

  // Check if the hex string represents more than 32 bytes
  if (numBytes > sz) {
    throw new Error('Hexadecimal string represents more than 32 bytes');
  }

  // Create a buffer of 32 bytes, filled with zeros
  const bytes = new Uint8Array(sz);

  // Convert hex string to bytes in a big-endian format
  for (let i = 0, j = 0; i < hexString.length; i += 2, j++) {
    bytes[j] = parseInt(hexString.substring(i, i + 2), 16);
  }

  return bytes;
}
