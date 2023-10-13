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
} from './interfaceKind';
import {
  fromFailablePromise,
  fromFailableVoidPromise
} from '@utils/fp/TaskEither';
import * as E from 'fp-ts/Either';

export interface CachedProof {
  publicInputArgs: unknown;
  proof: JsonProof;
}

export type ProofKey = string;

export type CheckCachedProofs<I extends InterfaceKind> = (
  check: (p: CachedProof) => RetType<I, boolean>
) => RetType<I, void>;

export interface IProofCache<I extends InterfaceKind>
  extends WithInterfaceTag<I> {
  storeProof(p: CachedProof): RetType<I, string>;
  getProof(k: ProofKey): RetType<I, Option<CachedProof>>;
  invalidateProof(k: ProofKey): RetType<I, void>;

  checkEachProof: CheckCachedProofs<I>;
}

export interface IProofCacheProvider<I extends InterfaceKind>
  extends WithInterfaceTag<I> {
  getCacheOf(plugin: string): RetType<I, IProofCache<I>>;

  initCacheFor(plugin: string): RetType<I, void>;
}

export const tsToFpProofCacheProvider = (
  i: IProofCacheProvider<TsInterfaceType>
): IProofCacheProvider<FpInterfaceType> => {
  return {
    __interface_tag: 'fp',
    getCacheOf: (plugin) =>
      fromFailablePromise(() => i.getCacheOf(plugin).then(tsToFpProofCache)),
    initCacheFor: (plugin) =>
      fromFailableVoidPromise(() => i.initCacheFor(plugin))
  };
};

export const tsToFpProofCache = (
  i: IProofCache<TsInterfaceType>
): IProofCache<FpInterfaceType> => {
  return {
    __interface_tag: 'fp',
    storeProof: (p) => fromFailablePromise(() => i.storeProof(p)),
    getProof: (k) => fromFailablePromise(() => i.getProof(k)),
    invalidateProof: (k) => fromFailableVoidPromise(() => i.invalidateProof(k)),
    checkEachProof: (f) =>
      fromFailableVoidPromise(() =>
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

export const fpToTsCheckCachedProofs = (
  f: CheckCachedProofs<FpInterfaceType>
): CheckCachedProofs<TsInterfaceType> => {
  return (check) =>
    f((p) => fromFailablePromise(() => check(p)))().then(
      E.match(
        (err) => Promise.reject(err),
        (v) => Promise.resolve(v)
      )
    );
};

class InMemoryProofCache implements IProofCache<FpInterfaceType> {
  readonly __interface_tag = 'fp';

  private cache: IORef<Record<ProofKey, CachedProof>>;

  constructor(cache: IORef<Record<ProofKey, CachedProof>>) {
    this.cache = cache;
  }

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

  invalidateProof(k: ProofKey): TaskEither<string, void> {
    return TE.fromIO(this.cache.modify(R.deleteAt(k)));
  }

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
