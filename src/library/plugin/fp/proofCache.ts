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
import { fromFailablePromise } from '@utils/fp/TaskEither';
import * as E from 'fp-ts/Either';

export interface CachedProof {
  publicInputArgs: unknown;
  proof: JsonProof;
}

export type ProofKey = string;

export type FpCheckCachedProofs = (
  check: (p: CachedProof) => TaskEither<string, boolean>
) => TaskEither<string, void>;

export type TsCheckCachedProofs = (
  check: (p: CachedProof) => Promise<boolean>
) => Promise<void>;

export interface IProofCache {
  storeProof(p: CachedProof): TaskEither<string, ProofKey>;
  getProof(k: ProofKey): TaskEither<string, Option<CachedProof>>;
  invalidateProof(k: ProofKey): TaskEither<string, void>;

  checkEachProof: FpCheckCachedProofs;
}

export const toTsCheckCachedProof: (
  _: FpCheckCachedProofs
) => TsCheckCachedProofs =
  (f: FpCheckCachedProofs) =>
  (check: (p: CachedProof) => Promise<boolean>): Promise<void> =>
    f((p: CachedProof) => fromFailablePromise(() => check(p)))().then(
      E.match(
        (err) => Promise.reject(err),
        () => Promise.resolve()
      )
    );

export interface IProofCacheProvider {
  getCacheOf(plugin: string): TaskEither<string, IProofCache>;

  initCacheFor(plugin: string): TaskEither<string, void>;
}

class InMemoryProofCache implements IProofCache {
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

export class InMemoryProofCacheProvider implements IProofCacheProvider {
  private store: Record<string, Record<ProofKey, CachedProof>> = {};

  getCacheOf(plugin: string): TaskEither<string, IProofCache> {
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
