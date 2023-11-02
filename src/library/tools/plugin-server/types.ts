import { Configuration } from './config';
import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { PluginRuntime, PluginRuntimeEnv } from '@lib/server/pluginruntime';
import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as expressCore from 'express-serve-static-core';
import { tryCatchIO } from '@lib/utils/fp/readertaskeither';
import { Logger } from '@lib/plugin/logger';

/**
 * The data that is constantly available to the plugin server.
 */
export type PluginServerEnv = Readonly<{
  config: Configuration;
  rootLogger: Logger;
  pluginRuntimeEnv: PluginRuntimeEnv;
  expressApp: expressCore.Express;
}>;

/** The plugin server monad. Actions are TaskEither's (fallible async calls)
 *  that can read the PluginServerEnv.
 */
export type PluginServer<Ret> = ReaderTaskEither<PluginServerEnv, string, Ret>;

/** Lift PluginRuntime action into PluginServer action. */
export const liftPluginRuntime = <Ret>(
  a: PluginRuntime<Ret>
): PluginServer<Ret> =>
  pipe(
    askPluginRuntimeEnv(),
    RTE.chain((pluginRuntimeEnv) => RTE.fromTaskEither(a(pluginRuntimeEnv)))
  );

/** Use the instance of the underlying root logger. */
export const useRootLogger = (
  f: (logger: Logger) => void
): PluginServer<void> =>
  pipe(
    RTE.asks(({ rootLogger }: PluginServerEnv) => rootLogger),
    RTE.chain((rootLogger) => RTE.fromIO(() => f(rootLogger)))
  );

/** Get the underlying root logger of the plugin server. */
export const askRootLogger = (): PluginServer<Logger> =>
  RTE.asks(({ rootLogger }: PluginServerEnv) => rootLogger);

/** Get the underlying plugin runtime environment. */
export const askPluginRuntimeEnv = (): PluginServer<PluginRuntimeEnv> =>
  RTE.asks(({ pluginRuntimeEnv }: PluginServerEnv) => pluginRuntimeEnv);

/** Use the instance of the underlying express app. */
export const useExpressApp = (
  f: (app: expressCore.Express) => void
): PluginServer<void> =>
  withExpressApp((expressApp) =>
    tryCatchIO(
      () => f(expressApp),
      (err) => `error occurred while configuring express app: ${err}`
    )
  );

/** Call an effectful (PluginServer monad) function on the underlying express app. */
export const withExpressApp = <Ret>(
  f: (app: expressCore.Express) => PluginServer<Ret>
): PluginServer<Ret> =>
  pipe(
    askExpressApp(),
    RTE.chain((expressApp) => f(expressApp))
  );

/** Get the underlying express app from the plugin server environment. */
export const askExpressApp = (): PluginServer<expressCore.Express> =>
  RTE.asks(({ expressApp }: PluginServerEnv) => expressApp);

/** Get the plugin configuration from the plugin server environment. */
export const askConfig = (): PluginServer<Configuration> =>
  RTE.asks(({ config }: PluginServerEnv) => config);
