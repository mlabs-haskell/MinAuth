/**
 * @module MerkleTree
 * This module provides an implementation of a Merkle Tree, a fundamental component
 * in blockchain and cryptographic applications. It leverages the 'o1js' library for
 * efficient Merkle Tree operations and is tailored for managing leaves represented as `Field` elements.
 */
import { Field, MerkleTree as O1jsMerkleTree } from 'o1js';
import { TreeWitness, TREE_HEIGHT } from './merkle-membership-program.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import assert from 'assert';

class CustomSet<T> {
  private elements: T[] = [];
  constructor(
    elems: T[],
    private compare: (a: T, b: T) => boolean = (x, y) => x === y
  ) {
    elems.forEach((e) => this.add(e));
  }

  add(element: T) {
    if (!this.contains(element)) {
      this.elements.push(element);
    }
  }

  contains(element: T): boolean {
    return this.elements.some((e) => this.compare(e, element));
  }

  at(index: number): T {
    return this.elements[index];
  }

  get length(): number {
    return this.elements.length;
  }

  toArray(): T[] {
    return this.elements;
  }

  // Additional methods like delete, clear, etc. can be implemented as needed.
}

class CustomMap<K, V> {
  private _keys: K[] = [];
  private _values: V[] = [];

  constructor(private compare: (a: K, b: K) => boolean) {}

  set(key: K, value: V) {
    const existingIndex = this.keys.findIndex((existingKey) =>
      this.compare(existingKey, key)
    );
    if (existingIndex > -1) {
      // Replace the value if the key already exists
      this.values[existingIndex] = value;
    } else {
      // Add the new key and value
      this.keys.push(key);
      this.values.push(value);
    }
  }

  get(key: K): V | undefined {
    const keyIndex = this.keys.findIndex((existingKey) =>
      this.compare(existingKey, key)
    );
    if (keyIndex > -1) {
      return this.values[keyIndex];
    }
    return undefined;
  }

  has(key: K): boolean {
    return this.keys.some((existingKey) => this.compare(existingKey, key));
  }

  delete(key: K): boolean {
    const keyIndex = this.keys.findIndex((existingKey) =>
      this.compare(existingKey, key)
    );
    if (keyIndex > -1) {
      this.keys.splice(keyIndex, 1);
      this.values.splice(keyIndex, 1);
      return true;
    }
    return false;
  }

  clear() {
    this._keys = [];
    this._values = [];
  }

  get size(): number {
    return this.values.length;
  }

  get keys(): K[] {
    return this._keys;
  }

  get values(): V[] {
    return this._values;
  }

  // Additional methods like keys(), values(), entries(), forEach(), etc. can be implemented as needed.
}

/**
 * A wrapper class for the Merkle Tree implementation from 'o1js' library.
 * Non-unique leaves will be discarded.
 */
export class MerkleTree {
  /** Set of indexes of occupied leaves */
  private leafMap: CustomMap<Field, bigint>;

  /** Internal representation of the Merkle Tree using 'o1js' library */
  private merkleTree: O1jsMerkleTree;

  private readonly leaves: CustomSet<Field>;

  /**
   * Constructs a Merkle Tree from a given array of leaves.
   * @param leaves An array of `Field` elements to be used as leaves in the tree.
   */
  constructor(
    leaves: Field[],
    private readonly logger?: Logger
  ) {
    this.leaves = new CustomSet(leaves, (a, b) => a.equals(b).toBoolean());
    this.leafMap = this.mkLeafToIndexMap(this.leaves);
    this.merkleTree = new O1jsMerkleTree(TREE_HEIGHT);
    this.merkleTree.fill(this.leaves.toArray());
    if (this.logger) {
      const ls = leaves.map((leaf) => leaf.toString());
      this.logger.debug(
        `Merkle tree constructed with leaves: ${ls} and root: ${this.root.toString()}`
      );
    }
    assert(this.leafMap.size === this.leaves.length);
  }

  /**
   * Creates a mapping from leaves to their corresponding indices in the tree.
   * @param leaves An array of `Field` elements representing the leaves.
   * @returns A Map object mapping each leaf to its index.
   */
  private mkLeafToIndexMap(leaves: CustomSet<Field>): CustomMap<Field, bigint> {
    const leafToIndex = new CustomMap<Field, bigint>((a, b) =>
      a.equals(b).toBoolean()
    );
    for (let i = 0; i < leaves.length; i++) {
      leafToIndex.set(leaves.at(i), BigInt(i));
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
    if (this.logger) {
      const ls = this.leaves.toArray().map((leaf) => leaf.toString());
      this.logger?.debug(
        `Building a witness for leaf ${leaf.toString()} with index ${leafIndex} in tree with leaves: ${ls} and root: ${this.root.toString()}`
      );
    }
    if (leafIndex === undefined) {
      throw new Error('Leaf not found');
    }
    return new TreeWitness(this.merkleTree.getWitness(leafIndex));
  }
}
