import { IMinAuthPlugin, IMinAuthPluginFactory } from "plugin/pluginType";
import z from "zod";
import env from 'env-var';
import fs from 'fs';
import yaml from 'yaml';
import { SimplePreimagePlugin } from "plugins/simplePreimage/plugin";
import { SimplePasswordTreePlugin } from "plugins/passwordTree/plugin";

// TODO: make use of heterogeneous lists
export const untypedPlugins:
  Record<string,
    IMinAuthPluginFactory<IMinAuthPlugin<any, any>, any, any, any>>
  = {
  "SimplePreimagePlugin": SimplePreimagePlugin,
  "SimplePasswordTreePlugin": SimplePasswordTreePlugin
};

const serverConfigurationsSchema = z.object({
  server: z.object({
    address: z.string().ip().default("127.0.0.1"),
    port: z.bigint().default(BigInt(3001)),
  }),
  plugins: z.object
    (Object
      .entries(untypedPlugins)
      .reduce(
        (o, [n, p]) => ({ ...o, [n]: p.configurationSchema }),
        {}))
    .partial()
});

export type ServerConfigurations = z.infer<typeof serverConfigurationsSchema>;

export function readConfigurations(): ServerConfigurations {
  const configFile =
    env.get('MINAUTH_CONFIG')
      .default("config.yaml")
      .asString();
  const configFileContent = fs.readFileSync(configFile, 'utf8');
  const untypedConfig: any = yaml.parse(configFileContent);
  return serverConfigurationsSchema.parse(untypedConfig);
}