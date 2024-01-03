/**
 * @module MerkleTree
 * This module provides an implementation of a Merkle Tree, a fundamental component
 * in blockchain and cryptographic applications. It leverages the 'o1js' library for
 * efficient Merkle Tree operations and is tailored for managing leaves represented as `Field` elements.
 */
import { Field } from 'o1js';
import { MerkleTree as O1jsMerkleTree } from 'o1js';
import { TreeWitness, TREE_HEIGHT } from './merkle-membership-program';

/**
 * A wrapper class for the Merkle Tree implementation from 'o1js' library.
 */
export class MerkleTree {
  /** Set of indexes of occupied leaves */
  private leafMap: Map<Field, bigint>;

  /** Internal representation of the Merkle Tree using 'o1js' library */
  private merkleTree: O1jsMerkleTree;

  /**
   * Constructs a Merkle Tree from a given array of leaves.
   * @param leaves An array of `Field` elements to be used as leaves in the tree.
   */
  constructor(readonly leaves: Field[]) {
    this.leafMap = this.mkLeafToIndexMap(leaves);
    this.merkleTree = new O1jsMerkleTree(TREE_HEIGHT);
    this.merkleTree.fill(leaves);
  }

  /**
   * Creates a mapping from leaves to their corresponding indices in the tree.
   * @param leaves An array of `Field` elements representing the leaves.
   * @returns A Map object mapping each leaf to its index.
   */
  private mkLeafToIndexMap(leaves: Field[]): Map<Field, bigint> {
    const leafToIndex = new Map<Field, bigint>();
    for (let i = 0; i < leaves.length; i++) {
      leafToIndex.set(leaves[i], BigInt(i));
    }
    return leafToIndex;
  }

  /**
   * Returns the root of the Merkle Tree.
   * @returns The `Field` element representing the root of the tree.
   */
  get root(): Field {
    return this.merkleTree.getRoot();
  }

  /**
   * Returns the number of leaves in the Merkle Tree.
   * @returns The count of leaves as a bigint.
   */
  get leafCount(): number {
    return this.leafMap.size;
  }

  /**
   * Generates a witness for a given leaf in the Merkle Tree.
   * @param leaf The `Field` element for which the witness is to be generated.
   * @returns A `TreeWitness` object representing the proof of the leaf's inclusion in the tree.
   * @throws Error if the leaf is not found in the tree.
   */
  getWitness(leaf: Field): TreeWitness {
    const leafIndex = this.leafMap.get(leaf);
    if (leafIndex === undefined) {
      throw new Error('Leaf not found');
    }
    return new TreeWitness(this.merkleTree.getWitness(leafIndex));
  }
}
