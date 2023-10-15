import { TaskEither } from 'fp-ts/TaskEither';
import * as TE from 'fp-ts/TaskEither';
import { JsonProof } from 'o1js';
import { Option } from 'fp-ts/Option';
import * as IOE from 'fp-ts/IOEither';
import { pipe } from 'fp-ts/lib/function';
import { createHash } from 'crypto';
import * as O from 'fp-ts/Option';
import * as R from 'fp-ts/Record';
import { IORef, newIORef } from 'fp-ts/lib/IORef';
import * as IO from 'fp-ts/IO';
import {
  FpInterfaceType,
  InterfaceKind,
  RetType,
  TsInterfaceType,
  WithInterfaceTag
} from '@lib/common/interfaceKind';
import { fromPromise, fromVoidPromise } from '@utils/fp/TaskEither';
import * as E from 'fp-ts/Either';

/**
 * Proof should be stored along with all the information required to re-verify
 * it in any point in time.
 * In general ZKP required public inputs and a proof.
 * NOTE. Is there a case where some other information is required?
 */
export interface CachedProof {
  /**
   * Meant to store information required to access up-to-date public inputs.
   */
  publicInputArgs: unknown;
  /**
   * The cached proof itself.
   */
  proof: JsonProof;
}

/**
 * A key that cache uses to efficiently identify stored proofs.
 */
export type ProofKey = string;

// TODO: is my understanding correct that:
// checkEachProof: CheckCachedProofs<I>;
// is meant to validate the entire cache given a validator for proofs?
// And all proofs that are left after this operation should be regarded as valid?
// If so such an operation would be potentially computationally very expensive.

// TODO 2: I think that ProofCache should be redesigned
// Basically it should be meant as a helper for plugins to allow for their output validation.
// If we require that each plugin output is uniquely identifiable this can be enough to
// unlock this possibility.
/**
 * A type alias for a callback that takes a cached proof verifier and
 * verifies entire cache.
 */
export type CheckCachedProofs<I extends InterfaceKind> = (
  check: (p: CachedProof) => RetType<I, boolean>
) => RetType<I, void>;

export interface IProofCache<I extends InterfaceKind>
  extends WithInterfaceTag<I> {
  /**
   * Stores a proof and gives out its key for later retrieval.
   */
  storeProof(p: CachedProof): RetType<I, ProofKey>;

  /**
   * Retrieves a cached proof given its key
   */
  getProof(k: ProofKey): RetType<I, Option<CachedProof>>;

  /**
   * Invalidates a cached proof given its key
   */
  invalidateProof(k: ProofKey): RetType<I, void>;

  /**
   * Given a validator for a proof it validates the entire cache.
   */
  checkEachProof: CheckCachedProofs<I>;
}

/**
 *  Interface for types that realize the proof cache for plugins.
 */
export interface IProofCacheProvider<I extends InterfaceKind>
  extends WithInterfaceTag<I> {
  getCacheOf(plugin: string): RetType<I, IProofCache<I>>;

  initCacheFor(plugin: string): RetType<I, void>;
}

/**
 * Converts a cache provider from typescript interface kind
 * into the functional fp-ts interface style
 */
export const tsToFpProofCacheProvider = (
  i: IProofCacheProvider<TsInterfaceType>
): IProofCacheProvider<FpInterfaceType> => {
  return {
    __interface_tag: 'fp',
    getCacheOf: (plugin) =>
      fromPromise(() => i.getCacheOf(plugin).then(tsToFpProofCache)),
    initCacheFor: (plugin) => fromVoidPromise(() => i.initCacheFor(plugin))
  };
};

/**
 * Converts a proof cache from typescript interface kind
 * into the functional fp-ts interface style
 */
export const tsToFpProofCache = (
  i: IProofCache<TsInterfaceType>
): IProofCache<FpInterfaceType> => {
  return {
    __interface_tag: 'fp',
    storeProof: (p) => fromPromise(() => i.storeProof(p)),
    getProof: (k) => fromPromise(() => i.getProof(k)),
    invalidateProof: (k) => fromVoidPromise(() => i.invalidateProof(k)),
    checkEachProof: (f) =>
      fromVoidPromise(() =>
        i.checkEachProof((p) =>
          f(p)().then(
            E.match(
              (err) => Promise.reject(err),
              (v) => Promise.resolve(v)
            )
          )
        )
      )
  };
};

/**
 * Converts a check proof callback from typescript interface kind
 * into the functional fp-ts interface style
 */
export const fpToTsCheckCachedProofs = (
  f: CheckCachedProofs<FpInterfaceType>
): CheckCachedProofs<TsInterfaceType> => {
  return (check) =>
    f((p) => fromPromise(() => check(p)))().then(
      E.match(
        (err) => Promise.reject(err),
        (v) => Promise.resolve(v)
      )
    );
};

/**
 * An implementation of IProofCache that stores proofs in in-memory record.
 */
class InMemoryProofCache implements IProofCache<FpInterfaceType> {
  readonly __interface_tag = 'fp';

  private cache: IORef<Record<ProofKey, CachedProof>>;

  constructor(cache: IORef<Record<ProofKey, CachedProof>>) {
    this.cache = cache;
  }

  /**
   * Hashes the given proof and upserts it into the cache record.
   */
  storeProof(proof: CachedProof): TaskEither<string, ProofKey> {
    return TE.fromIOEither(
      pipe(
        IOE.tryCatch(
          () =>
            createHash('sha256').update(JSON.stringify(proof)).digest('hex'),
          (reason) => `unable to hash the proof: ${reason}`
        ),
        IOE.tapIO((hash) => () => this.cache.modify(R.upsertAt(hash, proof)))
      )
    );
  }

  getProof(k: ProofKey): TaskEither<string, Option<CachedProof>> {
    return TE.fromIO(pipe(this.cache.read, IO.map(R.lookup(k))));
  }

  /**
   * If a proof is matched by the given key it is removed from the cache.
   */
  invalidateProof(k: ProofKey): TaskEither<string, void> {
    return TE.fromIO(this.cache.modify(R.deleteAt(k)));
  }

  /**
   * For each proof in the cache it runs the given validator.
   * in parallel.
   * Then it leaves only those proofs that were validated to be true.
   */
  checkEachProof(
    f: (p: CachedProof) => TaskEither<string, boolean>
  ): TaskEither<string, void> {
    return pipe(
      TE.fromIO(this.cache.read),
      R.traverse(TE.ApplicativePar)((proof: CachedProof) =>
        pipe(
          f(proof),
          TE.map((keep) => (keep ? O.some(proof) : O.none))
        )
      ),
      TE.map(R.compact),
      TE.chain((r) => TE.fromIO(this.cache.write(r)))
    );
  }
}

/**
 * An implementation of IProofCacheProvider that uses in-memory caches
 * and similarly stores them in a in-memory record.
 */
export class InMemoryProofCacheProvider
  implements IProofCacheProvider<FpInterfaceType>
{
  readonly __interface_tag = 'fp';

  private store: Record<string, Record<ProofKey, CachedProof>> = {};

  getCacheOf(plugin: string): TaskEither<string, IProofCache<FpInterfaceType>> {
    return pipe(
      TE.fromOption(() => `cache for plugin ${plugin} not initialized`)(
        R.lookup(plugin)(this.store)
      ),
      TE.chain((r) => TE.fromIO(newIORef(r))),
      TE.chain((r) => TE.right(new InMemoryProofCache(r)))
    );
  }

  initCacheFor(plugin: string): TaskEither<string, void> {
    return pipe(R.has(plugin, this.store), (hasCache) =>
      TE.fromIO(() => {
        if (!hasCache) this.store = R.upsertAt(plugin, {})(this.store);
      })
    );
  }
}
