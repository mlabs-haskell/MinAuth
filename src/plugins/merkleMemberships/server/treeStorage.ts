import { AccountUpdate, Field, MerkleTree, Mina, PrivateKey } from 'o1js';
import * as O from 'fp-ts/Option';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import z from 'zod';
import fs from 'fs/promises';
import { TreeRootStorageContract } from '../common/treeRootStorageContract';
import { TaskEither } from 'fp-ts/TaskEither';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import {
  dropResult,
  findM,
  fromFailablePromise,
  liftZodParseResult
} from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as Str from 'fp-ts/string';
import { toArray } from 'fp-ts/ReadonlyArray';
import * as A from 'fp-ts/Array';
import { Either } from 'fp-ts/Either';
import * as E from 'fp-ts/Either';

/**
 * An interface for o1js Merkle trees store holding sets of members.
 *
 * It uses fp-ts TaskEither to allow failible async actions executed
 * during the tree operations.
 */
export interface TreeStorage {
  /** Get the root of the Merkle tree. */
  getRoot: () => TaskEither<string, Field>;

  /** Get a witness for given leaf index */
  getWitness: (
    leafIndex: bigint
  ) => TaskEither<string, O.Option<ZkProgram.TreeWitness>>;

  /** Check if there's a leaf under the given index */
  hasLeaf: (leafIndex: bigint) => TaskEither<string, boolean>;

  /** Set a Field value under the given index */
  setLeaf: (leafIndex: bigint, leaf: Field) => TaskEither<string, void>;

  /** Get the set of leaves as an array of optional Fields */
  getLeaves(): TaskEither<string, Array<O.Option<Field>>>;
}

/**
 * An implementation of the tree storage using in-memory data structures.
 */
export class InMemoryStorage implements TreeStorage {
  /** Set of indexes of occupied leaves */
  occupied: Set<bigint> = new Set();

  /** The underlying Merkle tree */
  merkleTree: MerkleTree = new MerkleTree(ZkProgram.TREE_HEIGHT);

  /** The Merkle tree root */
  getRoot(): TaskEither<string, Field> {
    return TE.of(this.merkleTree.getRoot());
  }

  /** Get a witness for given leaf index */
  getWitness(leafIndex: bigint) {
    return TE.of(
      this.occupied.has(leafIndex)
        ? O.none
        : O.some(
            new ZkProgram.TreeWitness(this.merkleTree.getWitness(leafIndex))
          )
    );
  }

  /** Check if there's a leaf under the given index */
  hasLeaf(leafIndex: bigint) {
    return TE.of(this.occupied.has(leafIndex));
  }

  /** Set a Field value under the given index */
  setLeaf(leafIndex: bigint, leaf: Field) {
    return TE.fromIO(() => {
      this.occupied.add(leafIndex);
      this.merkleTree.setLeaf(leafIndex, leaf);
    });
  }

  /** Get the set of leaves as an array of optional Fields */
  getLeaves() {
    return (): Promise<Either<string, Array<O.Option<Field>>>> => {
      const leaves: Array<O.Option<Field>> = new Array(
        Number(this.merkleTree.leafCount)
      );

      for (let i = 0; i < this.merkleTree.leafCount; i++)
        leaves[i] = this.occupied.has(BigInt(i))
          ? O.some(this.merkleTree.getNode(0, BigInt(i)))
          : O.none;

      return Promise.resolve(E.right(leaves));
    };
  }
}

/**
 * An implementation of the tree storage using a file system handle.
 */
export class PersistentInMemoryStorage extends InMemoryStorage {
  readonly file: fs.FileHandle;

  /**
   * Write current state of the storage to the file.
   */
  persist(): TaskEither<string, void> {
    const storageObj = Array.from(this.occupied.values()).reduce(
      (acc: Record<number, string>, idx: bigint) => {
        acc[Number(idx)] = this.merkleTree.getNode(0, idx).toJSON();
        return acc;
      },
      {}
    );

    return dropResult(
      fromFailablePromise(
        () => this.file.write(JSON.stringify(storageObj), 0, 'utf-8'),
        ''
      )
    );
  }

  private constructor(
    file: fs.FileHandle,
    occupied: Set<bigint>,
    merkleTree: MerkleTree
  ) {
    super();
    this.file = file;
    this.occupied = occupied;
    this.merkleTree = merkleTree;
  }

  /**
   * Initialize the storage from a file.
   * If the file is empty, initialize the storage with the given leaves.
   */
  static initialize(
    path: string,
    initialLeaves?: Record<string, string>
  ): TaskEither<string, PersistentInMemoryStorage> {
    const { O_CREAT, O_RDWR } = fs.constants;
    return pipe(
      TE.Do,
      TE.bind('handle', () =>
        fromFailablePromise(
          () => fs.open(path, O_CREAT | O_RDWR),
          `unable to open file ${path} that stores the tree`
        )
      ),
      TE.bind('content', ({ handle }) =>
        fromFailablePromise(
          () => handle.readFile('utf-8'),
          `unable to read the content of the tree file`
        )
      ),
      TE.bind('storageObject', ({ content }) =>
        Str.isEmpty(content)
          ? TE.right(initialLeaves ?? {})
          : liftZodParseResult(
              z.record(z.string(), z.string()).safeParse(JSON.parse(content))
            )
      ),
      TE.map(({ handle, storageObject }) => {
        const { occupied, merkleTree } = R.reduceWithIndex(Str.Ord)(
          {
            occupied: new Set<bigint>(),
            merkleTree: new MerkleTree(ZkProgram.TREE_HEIGHT)
          },
          (rawIdx: string, { occupied, merkleTree }, rawLeaf: string) => {
            const idx = BigInt(rawIdx);
            occupied.add(BigInt(rawIdx));
            merkleTree.setLeaf(idx, Field.fromJSON(rawLeaf));
            return { occupied, merkleTree };
          }
        )(storageObject);
        return new PersistentInMemoryStorage(handle, occupied, merkleTree);
      }),
      // call persist in case the file is newly created
      TE.tap((s) => s.persist())
    );
  }
}

/**
 * A tree storage implementation with additional method `updateTreeRootOnChainIfNecessary`
 * that updates the root stored on chain if the off-chain root differs from the on-chain one.
 */
export class GenericMinaBlockchainTreeStorage<T extends TreeStorage>
  implements TreeStorage
{
  private underlyingStorage: T;
  private contract: TreeRootStorageContract;
  private mkTx: (txFn: () => void) => TaskEither<string, void>;

  constructor(
    storage: T,
    contract: TreeRootStorageContract,
    mkTx: (txFn: () => void) => TaskEither<string, void>
  ) {
    this.underlyingStorage = storage;
    this.contract = contract;
    this.mkTx = mkTx;
  }

  private fetchOnChainRoot(): TaskEither<string, Field> {
    return fromFailablePromise(
      this.contract.treeRoot.fetch,
      'unable to fetch root stored on chain, did you deploy the contract?'
    );
  }

  /**
   * Fetch the root stored on chain, compare to the off-chain counterpart
   * and update the on-chain root if necessary.
   */
  updateTreeRootOnChainIfNecessary(): TaskEither<string, void> {
    return pipe(
      TE.Do,
      TE.bind('onChainRoot', () => this.fetchOnChainRoot()),
      TE.bind('offChainRoot', () => this.underlyingStorage.getRoot()),
      TE.chain(({ onChainRoot, offChainRoot }) => {
        return onChainRoot.equals(offChainRoot).toBoolean()
          ? TE.of(undefined)
          : this.mkTx(() => this.contract.treeRoot.set(offChainRoot));
      })
    );
  }

  /**
   * Get the off-chain Merkle tree root.
   */
  getRoot() {
    return this.underlyingStorage.getRoot();
  }

  /** Get a witness for given leaf index */
  getWitness(leafIdx: bigint) {
    return this.underlyingStorage.getWitness(leafIdx);
  }

  /** Check if there's a leaf under the given index */
  hasLeaf(leafIdx: bigint) {
    return this.underlyingStorage.hasLeaf(leafIdx);
  }

  /** Set a Field value under the given index
   *
   * NOTE. This function does not update the on-chain root.
   */
  setLeaf(leafIndex: bigint, leaf: Field) {
    return TE.chain(() => this.updateTreeRootOnChainIfNecessary())(
      this.underlyingStorage.setLeaf(leafIndex, leaf)
    );
  }

  /** Get the set of leaves as an array of optional Fields */
  getLeaves() {
    return this.underlyingStorage.getLeaves();
  }
}

/**
 * Initialize a blockchain tree storage.
 * The funciton will:
 *  - compile and deploy the tree root storage contract if necessary
 *  - initialize the mina storage using the given storage
 *  - update the on-chain root to the one available through proviced storage
 */
function initializeGenericMinaBlockchainTreeStorage<T extends TreeStorage>(
  storage: T,
  contractPrivateKey: PrivateKey,
  feePayerPrivateKey: PrivateKey
): TaskEither<string, GenericMinaBlockchainTreeStorage<T>> {
  const contractPublicKey = contractPrivateKey.toPublicKey();
  const contractInstance = new TreeRootStorageContract(contractPublicKey);

  const feePayerPublicKey = feePayerPrivateKey.toPublicKey();

  const mkTx = (txFn: () => void): TaskEither<string, void> =>
    fromFailablePromise(async () => {
      const txn = await Mina.transaction(feePayerPublicKey, txFn);
      await txn.prove();
      await txn.sign([feePayerPrivateKey, contractPrivateKey]).send();
    }, 'unable to make transaction');

  const blockchainStorage = new GenericMinaBlockchainTreeStorage(
    storage,
    contractInstance,
    mkTx
  );

  const compileContract = fromFailablePromise(
    TreeRootStorageContract.compile,
    'cannot compile tree root storage contract, this is a bug'
  );

  const deployContractIfNecessary: TaskEither<string, void> = pipe(
    TE.Do,
    TE.bind('treeRoot', storage.getRoot),
    TE.bind('shouldDeployContract', () =>
      TE.of(Mina.hasAccount(contractPublicKey))
    ),
    TE.chain(({ shouldDeployContract, treeRoot }) =>
      shouldDeployContract
        ? mkTx(() => {
            AccountUpdate.fundNewAccount(feePayerPublicKey);
            contractInstance.treeRoot.set(treeRoot);
            contractInstance.deploy();
          })
        : blockchainStorage.updateTreeRootOnChainIfNecessary()
    )
  );

  return pipe(
    TE.Do,
    TE.chain(() => compileContract),
    TE.chain(() => deployContractIfNecessary),
    TE.chain(() => TE.of(blockchainStorage))
  );
}

/**
 * A Merkle tree storage that keeps the tree root on Mina blockchain
 * guarded by a contract controlled by a private key.
 * The tree itself is stored in the off-chain file storage.
 */
export class MinaBlockchainTreeStorage extends GenericMinaBlockchainTreeStorage<PersistentInMemoryStorage> {
  static initialize(
    path: string,
    contractPrivateKey: PrivateKey,
    feePayerPrivateKey: PrivateKey,
    initialLeaves?: Record<string, string>
  ): TaskEither<string, MinaBlockchainTreeStorage> {
    return pipe(
      TE.Do,
      TE.bind('storage', () =>
        PersistentInMemoryStorage.initialize(path, initialLeaves)
      ),
      TE.chain(({ storage }) =>
        initializeGenericMinaBlockchainTreeStorage(
          storage,
          contractPrivateKey,
          feePayerPrivateKey
        )
      )
    );
  }
}

/**
 * An interface of an entity that provides access to a set of Merkle trees.
 */
export interface TreesProvider {
  getTree(treeRoot: Field): TaskEither<string, O.Option<TreeStorage>>;
  getTreeRoots(): TaskEither<string, Array<Field>>;
}

/**
 * Schema for the configuration of a Mina trees provider.
 */
export const minaTreesProviderConfigurationSchema = z.object({
  feePayerPrivateKey: z.string().optional(),
  trees: z.array(
    z.object({
      contractPrivateKey: z.string().optional(),
      offchainStoragePath: z.string(),
      initialLeaves: z.record(z.string()).optional()
    })
  )
});

/**
 * Type of the configuration of the Mina trees provider.
 */
export type MinaTreesProviderConfiguration = z.infer<
  typeof minaTreesProviderConfigurationSchema
>;

/**
 * Implements a trees provider that uses Mina blockchain to store the roots of the trees.
 * The trees are stored in the off-chain storage.
 */
export class MinaTreesProvider implements TreesProvider {
  readonly treeStorages: Array<TreeStorage>;

  getTree(treeRoot: Field): TaskEither<string, O.Option<TreeStorage>> {
    return findM((t: TreeStorage) =>
      pipe(
        t.getRoot(),
        TE.map((root) => root.equals(treeRoot).toBoolean())
      )
    )(this.treeStorages);
  }

  getTreeRoots(): TaskEither<string, Array<Field>> {
    return A.traverse(TE.ApplicativePar)((t: TreeStorage) => t.getRoot())(
      this.treeStorages
    );
  }

  constructor(treeStorages: TreeStorage[]) {
    this.treeStorages = treeStorages;
  }

  static initialize(
    cfg: MinaTreesProviderConfiguration
  ): TaskEither<string, MinaTreesProvider> {
    const feePayerPrivateKey = cfg.feePayerPrivateKey
      ? PrivateKey.fromBase58(cfg.feePayerPrivateKey)
      : undefined;

    const trees = TE.traverseArray(
      (tCfg: {
        offchainStoragePath: string;
        contractPrivateKey?: string | undefined;
        initialLeaves?: Record<string, string>;
      }): TaskEither<string, TreeStorage> =>
        feePayerPrivateKey && tCfg.contractPrivateKey
          ? MinaBlockchainTreeStorage.initialize(
              tCfg.offchainStoragePath,
              PrivateKey.fromBase58(tCfg.contractPrivateKey),
              feePayerPrivateKey,
              tCfg.initialLeaves
            )
          : PersistentInMemoryStorage.initialize(
              tCfg.offchainStoragePath,
              tCfg.initialLeaves
            )
    )(cfg.trees);

    return TE.map(
      (ts: readonly TreeStorage[]) => new MinaTreesProvider(toArray(ts))
    )(trees);
  }
}
