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
import * as A from 'fp-ts/Array';

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
  try {
    return () =>
      p().then(
        (v: T | undefined) => E.fromNullable(errMsg('undefined result'))(v),
        (err) => E.left(errMsg(err))
      );
  } catch (err: unknown) {
    return () => Promise.resolve(E.left(errMsg(err)));
  }
}

/**
 * Discards the task's return value.
 */
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
 * Converts a promise that may resolve into an empty value into a TaskEither
 * object that fails with a message if the promise resolves into an empty value
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
 * TODO: move to avoid depending on express.js
 */
export const wrapTrivialExpressHandler =
  <R>(
    f: (req: Express.Request) => TaskEither<string, R>,
    onError: (err: string) => {
      statusCode: number;
      body: unknown;
    } = (err) => ({ statusCode: 400, body: { error: err } })
  ) =>
  (req: Express.Request, resp: Express.Response): Promise<void> =>
    pipe(
      f(req),
      TE.tapIO((result) => () => resp.status(200).json(result)),
      TE.tapError((error: string) =>
        TE.fromIO(() => {
          const { statusCode, body } = onError(error);
          resp.status(statusCode).json(body);
        })
      ),
      T.asUnit
    )();

/**
 * Given an assertion and an error stop the task execution when the condition is false.
 * All that within TaskEither monad.
 */
export const guard = (cond: boolean, msg: string): TaskEither<string, void> =>
  cond ? TE.right(undefined) : TE.left(msg);

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

/**
 * Find the first element in the array that satisfies the given predicate.
 * @param f A predicate, that can be a failible async action.
 * @param arr An array to search.
 * @returns A failible async action that returns the first element in the array
 *          that satisfies the given predicate.
 */
export const findM =
  <T>(f: (x: T) => TaskEither<string, boolean>) =>
  (arr: Array<T>): TaskEither<string, O.Option<T>> =>
    A.foldLeft(
      () => TE.right(O.none),
      (x: T, tail: Array<T>) =>
        pipe(
          pipe(
            f(x),
            TE.chain((found) => (found ? TE.right(O.some(x)) : findM(f)(tail)))
          )
        )
    )(arr);
