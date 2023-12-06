import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import * as IOE from 'fp-ts/lib/IOEither.js';
import * as E from 'fp-ts/lib/Either.js';
import * as z from 'zod';
import { ILogObj, Logger } from 'tslog';

/**
 * Construct a ReaderTaskEither from a function that performs side effects and
 * may throw.
 */
export const tryCatchIO = <Env, Err, Ret>(
  f: (env: Env) => Ret,
  onThrow: (reason: unknown) => Err
): ReaderTaskEither<Env, Err, Ret> =>
  pipe(
    RTE.ask<Env>(),
    RTE.chain((env) => RTE.fromIOEither(IOE.tryCatch(() => f(env), onThrow)))
  );

/**
 * Convert a promise that may reject into a ReaderTaskEither.
 */
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

/**
 * Given an error and a condition, throw the error when the condition is false.
 */
export const guard =
  <Env, Err>(err: Err) =>
  (cond: boolean): ReaderTaskEither<Env, Err, void> =>
    cond ? RTE.right(undefined) : RTE.left(err);

export const liftZodParseResult = <R, E, I, O>(
  r: z.SafeParseReturnType<I, O>,
  onThrow: (err: z.ZodError<I>) => E
): ReaderTaskEither<R, E, O> =>
  r.success ? RTE.right(r.data) : RTE.left(onThrow(r.error));

/**
 * Assuming the reader environment is a string-indexable object, return the field
 * in the environment of the given key.
 */
export const askRecordField = <
  P extends string,
  R extends { [key in P]: unknown },
  Err = never
>(
  key: P
): ReaderTaskEither<R, Err, R[P]> => RTE.asks((env) => env[key]);

/**
 * Returns the logger stored within RTE env.
 */
export const askLogger = <
  R extends { logger: LoggerType },
  LoggerType extends Logger<LogObjType>,
  LogObjType extends ILogObj = ILogObj,
  Err = never
>(): ReaderTaskEither<R, Err, LoggerType> => askRecordField('logger');

/**
 * Pass a function accepting the logger stored within RTE env
 * to call it with the logger.
 */
export const useLogger = <
  R extends { logger: LoggerType },
  B,
  LoggerType extends Logger<LogObjType>,
  LogObjType extends ILogObj = ILogObj,
  Err = never
>(
  f: (l: LoggerType) => B
): ReaderTaskEither<R, Err, void> =>
  pipe(
    askRecordField<'logger', R, Err>('logger'),
    RTE.chain((logger: LoggerType) => RTE.fromIO(() => f(logger))),
    RTE.asUnit
  );

/**
 * Pass a function accepting the logger stored within RTE env
 * to call it with the logger.
 * It will passthrough the given task either action
 * - to be used within monadic actions chains.
 */
export const tapLogger = <
  R extends { logger: LoggerType },
  A,
  B,
  LoggerType extends Logger<LogObjType>,
  LogObjType extends ILogObj = ILogObj,
  Err = never
>(
  f: (logger: LoggerType, x: A) => B
): ((_: ReaderTaskEither<R, Err, A>) => ReaderTaskEither<R, Err, A>) =>
  RTE.tap((x) =>
    pipe(
      askRecordField<'logger', R, Err>('logger'),
      RTE.chain((logger: LoggerType) => RTE.fromIO(() => f(logger, x)))
    )
  );

/**
 * Returns a sublogger of the logger stored within RTE env.
 */
export const askSublogger = <
  R extends { logger: Logger<LogObjType> },
  Err = never,
  LogObjType extends ILogObj = ILogObj
>(
  loggerName: string
): ReaderTaskEither<R, Err, Logger<LogObjType>> =>
  pipe(
    askRecordField<'logger', R, Err>('logger'),
    RTE.chainIOK(
      (logger) => (): Logger<LogObjType> =>
        logger.getSubLogger({ name: loggerName })
    )
  );

/**
 * Execute a computation in a modified environment.
 */
export const withRTE =
  <R1, R2, E1, E2>(mapErr: (_: E2) => E1, mapEnv: (_: R1) => R2) =>
  <A>(f: ReaderTaskEither<R2, E2, A>): ReaderTaskEither<R1, E1, A> =>
    pipe(
      RTE.ask<R1, E1>(),
      RTE.map(mapEnv),
      RTE.chain(
        (r2): ReaderTaskEither<R1, E1, A> =>
          pipe(RTE.fromTaskEither(f(r2)), RTE.mapLeft(mapErr))
      )
    );
