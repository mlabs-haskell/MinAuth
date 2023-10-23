import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as IOE from 'fp-ts/IOEither';
import * as E from 'fp-ts/Either';

export const tryCatchIO = <Env, Err, Ret>(
  f: (env: Env) => Ret,
  onThrow: (reason: unknown) => Err
): ReaderTaskEither<Env, Err, Ret> =>
  pipe(
    RTE.ask<Env>(),
    RTE.chain((env) => RTE.fromIOEither(IOE.tryCatch(() => f(env), onThrow)))
  );

export const tryCatch = <Env, Err, Ret>(
  f: (env: Env) => Promise<Ret>,
  onThrow: (reason: unknown) => Err
): ReaderTaskEither<Env, Err, Ret> =>
  pipe(
    RTE.ask<Env>(),
    RTE.chain((env) =>
      RTE.fromTaskEither(() =>
        f(env).then(
          (res) => E.right(res),
          (err) => E.left(onThrow(err))
        )
      )
    )
  );

export const guard =
  <Env, Err>(err: Err) =>
  (cond: boolean): ReaderTaskEither<Env, Err, void> =>
    cond ? RTE.right(undefined) : RTE.left(err);
