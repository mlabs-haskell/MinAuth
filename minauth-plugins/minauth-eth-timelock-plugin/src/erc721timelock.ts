import { ethers } from 'ethers';
import { ERC721TimeLock as ERC721TimeLockContract } from './typechain/contracts/ERC721TimeLock';
import { ERC721TimeLock__factory } from './typechain/factories/contracts/ERC721TimeLock__factory';
import { MerkleTree } from './merkle-tree';
import { IERC721_ABI } from './ierc721-abi.js';
import { UserCommitmentHex, commitmentHexToField } from './common';

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
  private contract: ERC721TimeLockContract;
  private nftContract: ethers.Contract;

  constructor(
    private readonly signer: ethers.JsonRpcSigner,
    readonly lockContractAddress: string,
    readonly erc721ContractAddress: string,
    readonly ethereumProvider: ethers.BrowserProvider | ethers.JsonRpcProvider
  ) {
    this.contract = ERC721TimeLock__factory.connect(
      lockContractAddress,
      ethereumProvider
    );
    this.nftContract = new ethers.Contract(
      erc721ContractAddress,
      IERC721_ABI,
      this.signer
    );
  }

  // ... static initialize method ...
  static async initialize(
    addresses: { lockContractAddress: string; nftContractAddress: string },
    ethereumProvider: ethers.BrowserProvider | ethers.JsonRpcProvider
  ) {
    const signer = await ethereumProvider.getSigner();

    return new Erc721TimeLock(
      signer,
      addresses.lockContractAddress,
      addresses.nftContractAddress,
      ethereumProvider
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
    const approvalTx = await this.nftContract.approve(
      this.lockContractAddress,
      tokenId
    );
    await approvalTx.wait();

    // Lock the token
    const lockTx = await this.contract.lockToken(
      this.erc721ContractAddress,
      tokenId,
      // 0x.. is compatible with `BytesLike`
      commitmentHex
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
    const merkleTree = new MerkleTree(
      commitments.map((x) => commitmentHexToField(x).commitment)
    );
    return merkleTree;
  };
}
