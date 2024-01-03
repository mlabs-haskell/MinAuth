import { ethers } from 'ethers';
import { ERC721TimeLock } from './typechain/contracts/ERC721TimeLock';
import { ERC721TimeLock__factory } from './typechain/factories/contracts/ERC721TimeLock__factory';
import { MerkleTree } from './merkle-tree';
import { IERC721_ABI } from './ierc721-abi.js';
import { Field } from 'o1js';

export interface IEthContract {
  fetchEligibleCommitments(): Promise<{ commitments: string[] }>;
  buildCommitmentTree(): Promise<MerkleTree>;
  lockToken(tokenId: number, hash: string): Promise<void>;
  unlockToken(index: number): Promise<void>;
}

export class EthContract implements IEthContract {
  private contract: ERC721TimeLock;
  private nftContract: ethers.Contract;

  constructor(
    private readonly signer: ethers.JsonRpcSigner,
    readonly lockContractAddress: string,
    readonly erc721Address: string,
    readonly provider: ethers.BrowserProvider | ethers.JsonRpcProvider
  ) {
    this.contract = ERC721TimeLock__factory.connect(
      lockContractAddress,
      provider
    );
    this.nftContract = new ethers.Contract(
      erc721Address,
      IERC721_ABI,
      this.signer
    );
  }

  // ... static initialize method ...
  static async initialize(
    lockContractAddress: string,
    nftContractAddress: string,
    provider: ethers.BrowserProvider | ethers.JsonRpcProvider
  ) {
    const signer = await provider.getSigner();

    return new EthContract(
      signer,
      lockContractAddress,
      nftContractAddress,
      provider
    );
  }

  /**
   * Fetch the TokenLocked and TokenUnlocked events to get the hashes of currently locked tokens.
   */
  async fetchEligibleCommitments(): Promise<{ commitments: string[] }> {
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

    const commitments = Array.from(currentlyLockedTokens.values());
    return { commitments };
  }

  /**
   * Locks a token by first approving its transfer and then interacting with the lock contract.
   * @param tokenId The ID of the token to be locked.
   * @param hash The hash representing the token's commitment.
   */
  async lockToken(tokenId: number, hash: string): Promise<void> {
    // Approve the ERC721TimeLock contract to transfer the token
    const approvalTx = await this.nftContract.approve(
      this.lockContractAddress,
      tokenId
    );
    await approvalTx.wait();

    // Lock the token
    const lockTx = await this.contract.lockToken(
      this.erc721Address,
      tokenId,
      ethers.encodeBytes32String(hash)
    );
    await lockTx.wait();
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

    const merkleTree = new MerkleTree(commitments.map(convertToField));
    return merkleTree;
  };
}

export function convertToField(commitment: string): Field {
  // Ensure the commitment string starts with '0x'
  if (!commitment.startsWith('0x')) {
    commitment = '0x' + commitment;
  }

  const bigintCommitment = BigInt(commitment);
  return new Field(bigintCommitment);
}
