import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as T from 'fp-ts/lib/Task.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import * as Express from 'express';

/**
 * Converts a simple request handler from a functional-style definition
 * into a form expected by express.js
 * If the handler returns a value, it is returned as json with code 200
 * If the handler throws an error, it is logged and the code 400 is returned
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
