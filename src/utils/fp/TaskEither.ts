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

export function guardPassthrough<E>(
  cond: boolean,
  err: E
): <T>(ret: T) => TaskEither<E, T> {
  return (ret) => taskEither.fromEither(cond ? E.right(ret) : E.left(err));
}

export function dropResult<E, T>(t: TaskEither<E, T>): TaskEither<E, void> {
  return TE.map(() => undefined)(t);
}

export function liftZodParseResult<I, O>(
  r: z.SafeParseReturnType<I, O>
): TaskEither<string, O> {
  return TE.fromEither(r.success ? E.right(r.data) : E.left(String(r.error)));
}

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

export function safeGetNumberParam(
  key: string,
  params: { [key: string]: string }
): TaskEither<string, number> {
  return getParam(safeFromString(Number))(key, params);
}

export function safeGetFieldParam(
  key: string,
  params: { [key: string]: string }
): TaskEither<string, Field> {
  return getParam(safeFromString(Field))(key, params);
}

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

export const launchTE = <T>(t: TaskEither<string, T>): Promise<T> =>
  t().then((result: Either<string, T>) =>
    E.isLeft(result)
      ? Promise.reject(result.left)
      : Promise.resolve(result.right)
  );
