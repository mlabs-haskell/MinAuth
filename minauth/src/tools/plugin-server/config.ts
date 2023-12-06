import { z } from 'zod';
import * as PL from '../../server/plugin-fp-api.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import * as log from 'tslog';
import { Logger } from '../../plugin/logger.js';
import { PluginServerEnv } from './types.js';
import { fromFailableIO } from '../../utils/fp/taskeither.js';

import express from 'express';

/**
 * The plugin server configuration schema
 */
export const configurationSchema = PL.configurationSchema.extend({
  address: z.string().default('127.0.0.1'),
  port: z.number().default(3001),
  logLevel: z.number().max(6).min(0).default(2),
  logType: z.enum(['pretty', 'json', 'hidden']).default('pretty')
});

/**
 * The plugin server configuration
 */
export type Configuration = z.infer<typeof configurationSchema>;

const mkPluginDir = (name: string) => `./plugins/${name}/plugin`;

/**
 * The plugin server default configuration
 */
export const defaultConfiguration: Configuration = configurationSchema.parse({
  plugins: {
    'simple-preimage': {
      path: mkPluginDir('minauth-simple-preimage-plugin'),
      config: {
        loadRolesFrom: './.fixtures/roles.json'
      }
    },
    'merkle-memberships': {
      path: mkPluginDir('minauth-merkle-memberships-plugin'),
      config: {
        trees: [
          {
            offchainStoragePath: './.fixtures/tree1.json'
          },
          {
            offchainStoragePath: './.fixtures/tree2.json'
          }
        ]
      }
    }
  }
});

/**
 * The logger that works before server is fully configured.
 */
const preConfigurationLogger = (): TaskEither<string, Logger> =>
  TE.fromIO(
    () => new log.Logger({ name: 'minauth-plugin-server-pre-configuration' })
  );

/**
 * Call _readConfiguration with the preConfigurationLogger
 * and fallback to default configuration.
 */
export const readConfigurationFallback = (): TaskEither<
  string,
  Configuration
> =>
  pipe(
    preConfigurationLogger(),
    TE.chain((logger) =>
      pipe(
        PL._readConfiguration(logger)<Configuration>(
          configurationSchema.safeParse
        )(),
        TE.orElse((error) => {
          logger.warn(`unable to read configuration: ${error}, use default`);
          return TE.right<string, Configuration>(defaultConfiguration);
        }),
        TE.tapIO((cfg) => () => logger.info(`final configuration`, cfg))
      )
    )
  );

/**
 * Initializes the plugin server environment based on a given configuration.
 */
export const mkPluginServerEnv = (
  config: Configuration
): TaskEither<string, PluginServerEnv> =>
  pipe(
    TE.Do,
    TE.let('config', () => config),
    TE.bind('rootLogger', ({ config }) =>
      TE.fromIO(
        (): Logger =>
          new log.Logger({
            name: 'minauth-plugin-server',
            type: config.logType,
            minLevel: config.logLevel
          })
      )
    ),
    TE.bind('pluginRuntimeEnv', ({ config, rootLogger }) =>
      PL.initializePlugins(rootLogger)(config)
    ),
    TE.bind('expressApp', () => fromFailableIO(express))
  );
