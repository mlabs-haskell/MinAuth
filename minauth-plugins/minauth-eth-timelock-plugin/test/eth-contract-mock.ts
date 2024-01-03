import { IEthContract, convertToField } from '../src/ethcontract';
import { MerkleTree } from '../src/merkle-tree';
import { Field, Poseidon } from 'o1js';

export class MockEthContract implements IEthContract {
  private commitments: string[];
  private merkleTree: MerkleTree;

  private tokenMap: number[] = [];

  private updateMerkleTree = () => {
    this.merkleTree = new MerkleTree(this.commitments.map(convertToField));
  };

  constructor(n: number) {
    // Initialize commitments
    this.commitments = Array.from({ length: n }, (_, i) =>
      hex(Poseidon.hash([new Field(i)]).toString())
    );
    this.updateMerkleTree();

    // Initialize a MerkleTree with the commitments
  }

  async fetchEligibleCommitments(): Promise<{ commitments: string[] }> {
    return Promise.resolve({ commitments: this.commitments });
  }

  async buildCommitmentTree(): Promise<MerkleTree> {
    return Promise.resolve(this.merkleTree);
  }

  async lockToken(tokenId: number, hash: string): Promise<void> {
    this.tokenMap.push(this.commitments.length);
    this.commitments.push(hash);
    this.updateMerkleTree();
  }

  async unlockToken(index: number): Promise<void> {
    if (index >= 0 && index < this.tokenMap.length) {
      const ix = this.tokenMap[index];
      this.tokenMap.splice(index, 1);
      this.commitments.splice(ix, 1);
      this.updateMerkleTree();
    } else {
      throw new Error('Invalid index for unlockToken');
    }
  }
}

function hex(decimalStr: string): string {
  const decimalInt = parseInt(decimalStr, 10);
  if (isNaN(decimalInt)) {
    throw new Error('Invalid decimal string');
  }
  return '0x' + decimalInt.toString(16);
}
