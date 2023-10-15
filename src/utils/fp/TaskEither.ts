import { TaskEither } from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { taskEither } from 'fp-ts';
import * as TE from 'fp-ts/TaskEither';
import z from 'zod';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import * as R from 'fp-ts/Record';
import * as IOE from 'fp-ts/IOEither';
import { Either } from 'fp-ts/Either';
import { Field } from 'o1js';
import * as Express from 'express';
import * as T from 'fp-ts/Task';

/**
 * Converts a promise that may resolve into an empty value into
 * a TaskEither object that fails with a message if the promise resolves into an empty value
 * or is rejected, or throws an exception.
 */
export function fromFailablePromise<T>(
  p: () => Promise<T | undefined>,
  msg?: string
): TaskEither<string, T> {
  const errMsg = (err: unknown) =>
    msg ? `${msg}: ${String(err)}` : String(err);
  return () =>
    p().then(
      (v: T | undefined) => E.fromNullable(errMsg('undefined result'))(v),
      (err) => E.left(errMsg(err))
    );
}

/**
 * Converts a promise that resolves into an empty value into
 * a TaskEither object that returns `left` with a message on the promise rejection
 * and succeeds with `right` when resolved.
 */
export function fromFailableVoidPromise(
  p: () => Promise<void>,
  msg?: string
): TaskEither<string, void> {
  const errMsg = (err: unknown) =>
    msg ? `${msg}: ${String(err)}` : String(err);
  return () =>
    p().then(
      () => E.right(undefined),
      (err) => E.left(errMsg(err))
    );
}

/**
 * Given an assertion and error it will give function that either
 * stops the execution with the error on failed assertion or acts as identity function.
 * All that within TaskEither monad.
 */
export function guardPassthrough<E>(
  cond: boolean,
  err: E
): <T>(ret: T) => TaskEither<E, T> {
  return (ret) => taskEither.fromEither(cond ? E.right(ret) : E.left(err));
}

export function dropResult<E, T>(t: TaskEither<E, T>): TaskEither<E, void> {
  return TE.map(() => undefined)(t);
}

/**
 * Lifts zod parsing results into the TaskEither monad.
 */
export function liftZodParseResult<I, O>(
  r: z.SafeParseReturnType<I, O>
): TaskEither<string, O> {
  return TE.fromEither(r.success ? E.right(r.data) : E.left(String(r.error)));
}

/**
 * Having found a kv pair in a record by its key it applies given function on the value
 * and returns the results.
 */
export function getParam<T>(
  onSome: (param: string) => TaskEither<string, T>
): (key: string, params: { [key: string]: string }) => TaskEither<string, T> {
  return (key, params) =>
    pipe(
      R.lookup(key)(params),
      O.match(
        () => TE.left(`missing parameter: ${key}`),
        (p) => onSome(p)
      )
    );
}

/**
 * Safely construct a value from string.
 */
export function safeFromString<T>(
  ctor: (s: string) => T
): (s: string) => TaskEither<string, T> {
  return (s: string) =>
    TE.fromIOEither(
      IOE.tryCatch(
        () => ctor(s),
        (err) => `failed to construct from string: ${String(err)}`
      )
    );
}

/**
 * Safely retrieve a number from a record.
 */
export function safeGetNumberParam(
  key: string,
  params: { [key: string]: string }
): TaskEither<string, number> {
  return getParam(safeFromString(Number))(key, params);
}

/**
 * Safely retrieve a o1js Field value from a record.
 */
export function safeGetFieldParam(
  key: string,
  params: { [key: string]: string }
): TaskEither<string, Field> {
  return getParam(safeFromString(Field))(key, params);
}

/**
 * Converts a promise that may resolve into an empty value into
 * a TaskEither object that fails with a message if the promise resolves into an empty value
 * or is rejected, or throws an exception.
 */
export function fromFailableIO<A>(
  f: () => A | undefined,
  msg?: string
): TaskEither<string, A> {
  const onFailure = (err: unknown) =>
    msg ? `${msg}: ${String(err)}` : String(err);

  return async (): Promise<Either<string, A>> => {
    try {
      const ret = f();
      return ret === undefined ? E.left(onFailure('undefined')) : E.right(ret);
    } catch (err) {
      return E.left(onFailure(err));
    }
  };
}

/**
 * Converts a TaskEither to a Promise treating its left value as an promise rejection argument.
 * and its right value as a promise resolution argument.
 */
export const launchTE = <T>(t: TaskEither<string, T>): Promise<T> =>
  t().then((result: Either<string, T>) =>
    E.isLeft(result)
      ? Promise.reject(result.left)
      : Promise.resolve(result.right)
  );

/**
 * Converts a simple request handler from a functional-style definition
 * into a form expected by express.js
 * If the handler returns a value, it is returned as json with code 200
 * If the handler throws an error, it is logged and the code 400 is returned
 */
export const wrapTrivialExpressHandler =
  <R>(f: (req: Express.Request) => TaskEither<string, R>) =>
  (req: Express.Request, resp: Express.Response): Promise<void> =>
    pipe(
      f(req),
      TE.tapIO((result) => () => resp.status(200).json(result)),
      TE.tapError((error: string) =>
        TE.fromIO(() => {
          console.log(
            `error occurred while handling ${req.method} ${req.path}: ${error}`
          );
          resp.status(400).json({ error });
        })
      ),
      T.asUnit
    )();
