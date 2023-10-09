import { IMinAuthPlugin, IMinAuthPluginFactory } from '@lib/plugin/pluginType';
import z from 'zod';
import env from 'env-var';
import fs from 'fs';
import yaml from 'yaml';
import { SimplePreimagePlugin } from '@plugins/simplePreimage/server';
import { MerkleMembershipsPlugin } from '@plugins/merkleMemberships/server';

// TODO: make use of heterogeneous lists
/**
 * All the available plugins and their names go here.
 */
export const untypedPlugins: Record<
  string,
  IMinAuthPluginFactory<IMinAuthPlugin<any, any>, any, any, any>
> = {
  SimplePreimagePlugin: SimplePreimagePlugin,
  MerkleMembershipsPlugin: MerkleMembershipsPlugin
};

const serverConfigurationsSchema = z.object({
  server: z.object({
    address: z.string().ip().default('127.0.0.1'),
    port: z.number().default(3001)
  }),
  plugins: z
    .object(
      Object.entries(untypedPlugins).reduce(
        (o, [n, p]) => ({ ...o, [n]: p.configurationSchema }),
        {}
      )
    )
    .partial()
});

export type ServerConfigurations = z.infer<typeof serverConfigurationsSchema>;

const defaultConfiguration: ServerConfigurations = {
  server: {
    address: '127.0.0.1',
    port: 3001
  },
  plugins: {
    SimplePreimagePlugin: { roles: {} },
    MerkleMembershipsPlugin: { trees: [] }
  }
};

/**
 * Load configurations from disk. The configuration is encoded in yaml and
 * should conform to `serverConfigurationsSchema`. The location of the file can
 * be specified using the `MINAUTH_CONFIG` environmental variable; if it's not
 * set, `./config.yaml` will be used.
 * @returns The decoded configurations for the server and plugins.
 */
export function readConfigurations(): ServerConfigurations {
  const configFile = env
    .get('MINAUTH_CONFIG')
    .default('config.yaml')
    .asString();

  if (!fs.existsSync(configFile)) {
    console.warn(
      'configuration file not exists, use the default configuration'
    );
    return defaultConfiguration;
  }
  const configFileContent = fs.readFileSync(configFile, 'utf8');
  const untypedConfig: any = yaml.parse(configFileContent);
  return serverConfigurationsSchema.parse(untypedConfig);
}
