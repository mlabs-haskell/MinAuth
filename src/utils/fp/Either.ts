import { Either } from 'fp-ts/lib/Either';
import * as E from 'fp-ts/Either';

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
