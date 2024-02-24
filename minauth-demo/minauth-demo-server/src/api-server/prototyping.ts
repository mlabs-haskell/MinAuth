import z from 'zod';
import { IMinAuthPlugin } from 'minauth/dist/plugin/plugintype.js';
import { InMemoryPluginHost } from 'minauth/dist/server/in-memory-pluginhost.js'
import { Logger, ILogObj } from 'tslog'
// import { SimplePreimagePlugin } from 'simple-preimage-plugin/dist/plugin.js';
import { FpInterfaceType } from 'minauth/dist/plugin/interfacekind';



const PluginRoleMappingSchema = z.record(z.string(),z.array(z.string()))
type PluginRoleMapping = z.infer<typeof PluginRoleMappingSchema>
const logger = new Logger<ILogObj>();

// -------- API example  / prototyping

const somePlugin = {} as unknown as IMinAuthPlugin<FpInterfaceType, unknown, unknown>;

const pluginHost = new InMemoryPluginHost({ plugins: [{ name: 'some-plugin-1', plugin: somePlugin }] }, logger);

const authMapper = await PluginToRoleMapper.initialize(
  pluginHost,
  { 'simple-preimage-1': (plugin_output) =>  ['user'] }
);

const strategy = new MinAuthStrategy(authMapper, logger);
