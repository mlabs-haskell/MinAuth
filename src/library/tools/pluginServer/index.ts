import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import { mkPluginServerEnv, readConfigurationFallback } from './config';
import { setupAllRoutes, startServing } from './express';
import { PluginServer, useRootLogger } from './types';
import * as RTE from 'fp-ts/ReaderTaskEither';

const server: PluginServer<void> = pipe(
  setupAllRoutes(),
  RTE.chain(startServing),
  RTE.orElse((err) =>
    useRootLogger((logger) => {
      logger.error('unhandled error', err);
      process.exit(1);
    })
  )
);

const main = pipe(
  readConfigurationFallback(),
  TE.chain(mkPluginServerEnv),
  TE.chain(server)
);

main();
