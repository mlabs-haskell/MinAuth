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
  fromFailablePromise,
  liftZodParseResult
} from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as Str from 'fp-ts/string';
import { toArray } from 'fp-ts/ReadonlyArray';
import * as A from 'fp-ts/Array';
import { Either } from 'fp-ts/Either';
import * as E from 'fp-ts/Either';

export interface TreeStorage {
  getRoot: () => TaskEither<string, Field>;
  getWitness: (
    leafIndex: bigint
  ) => TaskEither<string, O.Option<ZkProgram.TreeWitness>>;
  hasLeaf: (leafIndex: bigint) => TaskEither<string, boolean>;
  setLeaf: (leafIndex: bigint, leaf: Field) => TaskEither<string, void>;
  getLeaves(): TaskEither<string, Array<O.Option<Field>>>;
}

export class InMemoryStorage implements TreeStorage {
  occupied: Set<bigint> = new Set();
  merkleTree: MerkleTree = new MerkleTree(ZkProgram.TREE_HEIGHT);

  getRoot() {
    return TE.of(this.merkleTree.getRoot());
  }

  getWitness(leafIndex: bigint) {
    return TE.of(
      this.occupied.has(leafIndex)
        ? O.none
        : O.some(
            new ZkProgram.TreeWitness(this.merkleTree.getWitness(leafIndex))
          )
    );
  }

  hasLeaf(leafIndex: bigint) {
    return TE.of(this.occupied.has(leafIndex));
  }

  setLeaf(leafIndex: bigint, leaf: Field) {
    return TE.fromIO(() => {
      this.occupied.add(leafIndex);
      this.merkleTree.setLeaf(leafIndex, leaf);
    });
  }

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

export class PersistentInMemoryStorage extends InMemoryStorage {
  readonly file: fs.FileHandle;

  persist(): TaskEither<string, void> {
    const storageObj = Array.from(this.occupied.values()).reduce(
      (acc: Record<number, string>, idx: bigint) => {
        acc[Number(idx)] = this.merkleTree
          .getNode(ZkProgram.TREE_HEIGHT, idx)
          .toJSON();
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

  static initialize(
    path: string
  ): TaskEither<string, PersistentInMemoryStorage> {
    return pipe(
      TE.Do,
      TE.bind('handle', () =>
        fromFailablePromise(
          () => fs.open(path, 'r+'),
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
        liftZodParseResult(z.record(z.string(), z.string()).safeParse(content))
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
      })
    );
  }
}

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

  getRoot() {
    return this.underlyingStorage.getRoot();
  }

  getWitness(leafIdx: bigint) {
    return this.underlyingStorage.getWitness(leafIdx);
  }

  hasLeaf(leafIdx: bigint) {
    return this.underlyingStorage.hasLeaf(leafIdx);
  }

  setLeaf(leafIndex: bigint, leaf: Field) {
    return TE.chain(() => this.updateTreeRootOnChainIfNecessary())(
      this.underlyingStorage.setLeaf(leafIndex, leaf)
    );
  }

  getLeaves() {
    return this.underlyingStorage.getLeaves();
  }
}

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

export class MinaBlockchainTreeStorage extends GenericMinaBlockchainTreeStorage<PersistentInMemoryStorage> {
  static initialize(
    path: string,
    contractPrivateKey: PrivateKey,
    feePayerPrivateKey: PrivateKey
  ): TaskEither<string, MinaBlockchainTreeStorage> {
    return pipe(
      TE.Do,
      TE.bind('storage', () => PersistentInMemoryStorage.initialize(path)),
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

export interface TreesProvider {
  getTree(treeRoot: Field): TaskEither<string, O.Option<TreeStorage>>;
}

export const minaTreesProviderConfigurationSchema = z.object({
  feePayerPrivateKey: z.string().optional(),
  trees: z.array(
    z.object({
      contractPrivateKey: z.string().optional(),
      offchainStoragePath: z.string()
    })
  )
});

export type MinaTreesProviderConfiguration = z.infer<
  typeof minaTreesProviderConfigurationSchema
>;

const findM =
  <T>(f: (x: T) => TaskEither<string, boolean>) =>
  (arr: Array<T>): TaskEither<string, O.Option<T>> =>
    A.foldLeft(
      () => TE.right(O.none),
      (x: T, left) =>
        pipe(
          pipe(
            f(x),
            TE.chain((found) => (found ? TE.right(O.some(x)) : findM(f)(left)))
          )
        )
    )(arr);

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
      }): TaskEither<string, TreeStorage> =>
        feePayerPrivateKey && tCfg.contractPrivateKey
          ? MinaBlockchainTreeStorage.initialize(
              tCfg.offchainStoragePath,
              PrivateKey.fromBase58(tCfg.contractPrivateKey),
              feePayerPrivateKey
            )
          : PersistentInMemoryStorage.initialize(tCfg.offchainStoragePath)
    )(cfg.trees);

    return TE.map(
      (ts: readonly TreeStorage[]) => new MinaTreesProvider(toArray(ts))
    )(trees);
  }
}
