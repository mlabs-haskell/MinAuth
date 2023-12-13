import { pipe } from 'fp-ts/lib/function.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import { mkPluginServerEnv, readConfigurationFallback } from './config.js';
import { setupAllRoutes, startServing } from './express.js';
import { PluginServer, useRootLogger } from './types.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';

/**
 * Start the plugin server.
 */
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

/**
 * Read the configuration, setup the plugin server environment and start the server.
 */
const main = pipe(
  readConfigurationFallback(),
  TE.chain(mkPluginServerEnv),
  TE.chain(server)
);

main();
