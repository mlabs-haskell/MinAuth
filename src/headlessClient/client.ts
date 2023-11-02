import { MinAuthProof } from '@lib/server/minauthstrategy';
import axios, { isAxiosError } from 'axios';
import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import path from 'path';
import * as z from 'zod';
import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import {
  liftZodParseResult,
  tryCatch,
  tryCatchIO,
  useLogger
} from '@lib/utils/fp/readertaskeither';
import { Option } from 'fp-ts/lib/Option';
import * as O from 'fp-ts/Option';
import { Logger } from '@lib/plugin/logger';

export type ClientEnv = Readonly<{
  serverUrl: string;
  logger: Logger;
}>;

export type ClientError =
  | {
      __tag: 'badUrl';
      reason: string;
    }
  | {
      __tag: 'ioFailure';
      reason: string;
    }
  | { __tag: 'badCredential' | 'badRequest'; respBody: unknown }
  | { __tag: 'serverError'; reason: string; respBody: unknown };

export type Client<T> = ReaderTaskEither<ClientEnv, ClientError, T>;

export const loginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string()
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({ token: z.string() });

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const accessProtectedResponseSchema = z.object({ message: z.string() });

export type AccessProtectedResponse = z.infer<
  typeof accessProtectedResponseSchema
>;

const mkUrl = (...pathComponents: string[]): Client<string> =>
  tryCatchIO(
    ({ serverUrl }: ClientEnv) =>
      new URL(path.join(...pathComponents), serverUrl).href,
    (err) => {
      return {
        __tag: 'badUrl',
        reason: String(err)
      };
    }
  );

const logAction = (action: string, parameter?: unknown): Client<void> =>
  useLogger((logger) => {
    logger.info(`performing ${action}`);
    if (parameter !== undefined) logger.debug(action, parameter);
  });

const tapAndLogError = (action: string): (<R>(_: Client<R>) => Client<R>) =>
  RTE.tapError((err) =>
    useLogger((logger) => logger.error(`${action} failed`, err))
  );

const wrapPublicApi =
  (action: string, parameter?: unknown) =>
  <R>(f: Client<R>): Client<R> =>
    pipe(
      logAction(action, parameter),
      RTE.chain(() => f),
      tapAndLogError(action)
    );

type Request<T> = {
  urlComponents: Array<string>;
  jwt: Option<string>;
  // We'll use this schema to parse the body of any successful(200) responses.
  respSchema: z.Schema<T>;
} & (
  | {
      method: 'GET';
    }
  | {
      method: 'POST';
      body: unknown;
    }
);

const mkRequest = <T>(req: Request<T>): Client<T> =>
  pipe(
    RTE.Do,
    RTE.bind('url', () => mkUrl(...req.urlComponents)),
    RTE.let('headers', () =>
      O.isNone(req.jwt)
        ? undefined
        : { Authorization: `Bearer ${req.jwt.value}` }
    ),
    RTE.let(
      'reqFn',
      ({ url, headers }) =>
        // This is pure: the returned value is a function.
        () =>
          req.method == 'GET'
            ? axios.get(url, { headers })
            : axios.post(url, req.body, { headers })
    ),
    // `reqFn` is actually carried out here.
    // We assume that the server would never response with status code
    // other than 200, 401 and 400.
    RTE.bind('resp', ({ reqFn }) =>
      tryCatch(
        reqFn,
        (err): ClientError =>
          isAxiosError(err) && err.response !== undefined
            ? // response status is not 200
              err.response.status == 401
              ? {
                  __tag: 'badCredential',
                  respBody: err.response.data
                }
              : err.response.status == 400
              ? {
                  __tag: 'badRequest',
                  respBody: err.response.data
                }
              : {
                  __tag: 'serverError',
                  reason: `bad status code: ${err.response.status}`,
                  respBody: err.response.data
                }
            : // no response
              {
                __tag: 'ioFailure',
                reason: `failed to make request: ${err}`
              }
      )
    ),
    RTE.chain(
      ({ resp }): Client<T> =>
        liftZodParseResult(
          req.respSchema.safeParse(resp.data),
          (err): ClientError => ({
            __tag: 'serverError',
            reason: `unable to parse response body: ${err}`,
            respBody: resp.data
          })
        )
    )
  );

export const login = (proof: MinAuthProof): Client<LoginResponse> =>
  wrapPublicApi(
    'login',
    proof
  )(
    mkRequest({
      method: 'POST',
      body: proof,
      urlComponents: ['login'],
      jwt: O.none,
      respSchema: loginResponseSchema
    })
  );

export const refresh = (
  jwt: string,
  refreshToken: string
): Client<RefreshResponse> =>
  wrapPublicApi('refresh')(
    mkRequest({
      method: 'POST',
      body: { refreshToken },
      urlComponents: ['token'],
      jwt: O.some(jwt),
      respSchema: refreshResponseSchema
    })
  );

export const accessProtected = (jwt: string): Client<AccessProtectedResponse> =>
  wrapPublicApi('accessProtected')(
    mkRequest({
      method: 'GET',
      urlComponents: ['protected'],
      jwt: O.some(jwt),
      respSchema: accessProtectedResponseSchema
    })
  );
