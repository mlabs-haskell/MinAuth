import { z } from 'zod';
import * as PL from '@lib/plugin/fp/pluginLoader';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

export const configurationSchema = PL.configurationSchema.extend({
  address: z.string().default('127.0.0.1'),
  port: z.number().default(3001)
});

export type Configuration = z.infer<typeof configurationSchema>;

const mkPluginDir = (name: string) =>
  `${__dirname}/../../../plugins/${name}/server`;

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

export const readConfigurationFallback = pipe(
  PL._readConfiguration<Configuration>(configurationSchema.safeParse)(),
  TE.orElse((error) => {
    console.warn(`unable to read configuration: ${error}, use default`);
    return TE.right(defaultConfiguration);
  }),
  TE.tap((cfg) => TE.fromIO(() => console.info('configuration', cfg)))
);
