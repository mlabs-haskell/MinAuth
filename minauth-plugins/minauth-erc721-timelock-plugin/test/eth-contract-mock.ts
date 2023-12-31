import { JsonRpcProvider } from 'ethers/lib.commonjs/providers/provider-jsonrpc';
import { IErc721TimeLock } from '../src/erc721timelock';
import { MerkleTree } from '../src/merkle-tree';
import { BrowserProvider, ethers } from 'ethers';
import {
  UserCommitmentHex,
  commitmentHexToField,
  mkUserSecret,
  userCommitmentHex
} from '../src/commitment-types.js';
import { Logger } from 'minauth/dist/plugin/logger';

export class MockErc721TimeLock implements IErc721TimeLock {
  private commitments: UserCommitmentHex[];
  private tokenMap: number[] = [];

  readonly ethereumProvider: BrowserProvider | JsonRpcProvider;

  get lockContractAddress() {
    return '0x0';
  }
  get erc721ContractAddress() {
    return '0x0';
  }

  private get merkleTree() {
    return new MerkleTree(
      this.commitments.map((x) => commitmentHexToField(x).commitment),
      this.logger
    );
  }

  constructor(
    n: number,
    ethereumProvider?: BrowserProvider | JsonRpcProvider,
    private readonly logger?: Logger
  ) {
    // Initialize commitments to correspond to users secret inputs of 0..n-1
    this.commitments = Array.from({ length: n }, (_, i) =>
      userCommitmentHex(mkUserSecret({ secret: String(i) }))
    );
    if (!ethereumProvider) {
      this.ethereumProvider = !ethereumProvider
        ? new ethers.JsonRpcProvider('http://127.0.0.1:8545')
        : ethereumProvider;
    }
  }

  async fetchEligibleCommitments(): Promise<{
    commitments: UserCommitmentHex[];
  }> {
    return Promise.resolve({ commitments: this.commitments });
  }

  async buildCommitmentTree(): Promise<MerkleTree> {
    return Promise.resolve(this.merkleTree);
  }

  async lockToken(_tokenId: number, hash: UserCommitmentHex): Promise<void> {
    this.tokenMap.push(this.commitments.length);
    this.commitments.push(hash);
  }

  async unlockToken(index: number): Promise<void> {
    if (index >= 0 && index < this.tokenMap.length) {
      const ix = this.tokenMap[index];
      this.tokenMap.splice(index, 1);
      this.commitments.splice(ix, 1);
    } else {
      throw new Error('Invalid index for unlockToken');
    }
  }
}
