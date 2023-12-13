import { Either } from 'fp-ts/lib/Either.js';
import * as E from 'fp-ts/lib/Either.js';

/**
 * Converts a failible string parse operation into an Either object.
 */
export const safeFromString =
  <Err, T>(ctor: (_: string) => T, onError: (_: unknown) => Err) =>
  (inp: string): Either<Err, T> => {
    try {
      const val = ctor(inp);
      return val === undefined ? E.left(onError(undefined)) : E.right(val);
    } catch (err) {
      return E.left(onError(err));
    }
  };
