import { MerkleTree } from '../src/merkle-tree';
import { Field } from 'o1js';
import { describe, expect, beforeAll, test } from '@jest/globals';

describe('MerkleTree', () => {
  let leaves: Field[];
  let merkleTree: MerkleTree;

  beforeAll(() => {
    // Initialize some leaves (mock or actual Field instances)
    leaves = [new Field(1), new Field(2), new Field(3)]; // Example leaves
    merkleTree = new MerkleTree(leaves);
  });

  test('should correctly construct a Merkle Tree', () => {
    expect(merkleTree).toBeInstanceOf(MerkleTree);
    expect(merkleTree.leafCount).toBe(leaves.length);
  });

  test('should return the correct root', () => {
    const root = merkleTree.root;
    expect(root).toBeInstanceOf(Field);
    // Additional checks can be added depending on the expected behavior of getRoot
  });

  test('should return the correct number of leaves', () => {
    expect(merkleTree.leafCount).toBe(leaves.length);
  });

  test('should generate a witness for a leaf', () => {
    for (const leaf of leaves) {
      const witness = merkleTree.getWitness(leaf);
      expect(witness).toBeDefined();
    }
  });

  test('should throw an error for a non-existent leaf', () => {
    const nonExistentLeaf = new Field(999);
    expect(() => {
      merkleTree.getWitness(nonExistentLeaf);
    }).toThrow('Leaf not found');
  });
});
