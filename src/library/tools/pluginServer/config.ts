import { z } from 'zod';
import * as PL from '@lib/plugin/fp/pluginLoader';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { TaskEither } from 'fp-ts/TaskEither';
import * as log from 'tslog';
import { Logger } from '@lib/plugin/fp/pluginType';
import { PluginServerEnv } from './types';
import { fromFailableIO } from '@utils/fp/TaskEither';

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

const mkPluginDir = (name: string) =>
  `${__dirname}/../../../plugins/${name}/server`;

/**
 * The plugin server default configuration
 */
export const defaultConfiguration: Configuration = configurationSchema.parse({
  plugins: {
    SimplePreimagePlugin: {
      path: mkPluginDir('simplePreimage'),
      config: {
        loadRolesFrom: './.fixtures/roles.json'
      }
    },
    MerkleMembershipsPlugin: {
      path: mkPluginDir('merkleMemberships'),
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
 * Call _readConfiruation with the preConfigurationLogger
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
