import { Configuration } from './fp/pluginLoader';
import * as fpPluginLoader from './fp/pluginLoader';
import * as expressCore from 'express-serve-static-core';
import * as fpUtils from './fp/utils';
import { JsonProof } from 'o1js';
import { launchTE } from '@utils/fp/TaskEither';
import { OutputValidity } from './fp/pluginType';
import { Logger } from 'tslog';

export * from './fp/pluginType';
export {
  configurationSchema,
  Configuration,
  UntypedPluginFactory,
  UntypedPluginModule
} from './fp/pluginLoader';
export * from './fp/interfaceKind';
import * as log from 'tslog';
import { PluginRuntimeEnv, launchPluginRuntime } from './fp/pluginRuntime';
export {
  RuntimePluginInstance,
  PluginRuntimeEnv,
  ActivePlugins
} from './fp/pluginRuntime';

const defaultRootLoggerConfiguration: log.ISettingsParam<log.ILogObj> = {
  name: 'minauth-plugin-system',
  type: 'pretty',
  minLevel: 2 // debug
};

const defaultRootLogger: Logger<log.ILogObj> = new Logger(
  defaultRootLoggerConfiguration
);

export const readConfiguration = (
  cfgPath?: string,
  logger: Logger<log.ILogObj> = defaultRootLogger
): Promise<Configuration> =>
  launchTE(fpPluginLoader.readConfiguration(logger)(cfgPath));

export const initializePlugins = (
  cfg: Configuration,
  logger: Logger<log.ILogObj> = defaultRootLogger
): Promise<PluginRuntimeEnv> =>
  launchTE(fpPluginLoader.initializePlugins(logger)(cfg));

export const installCustomRoutes = (
  env: PluginRuntimeEnv,
  app: expressCore.Express
): Promise<void> => launchPluginRuntime(env)(fpUtils.installCustomRoutes(app));

export const verifyProof = (
  env: PluginRuntimeEnv,
  proof: JsonProof,
  publicInputArgs: unknown,
  pluginName: string
): Promise<unknown> =>
  launchPluginRuntime(env)(
    fpUtils.verifyProof(proof, publicInputArgs, pluginName)
  );

export const validateOutput = (
  env: PluginRuntimeEnv,
  output: unknown,
  pluginName: string
): Promise<OutputValidity> =>
  launchPluginRuntime(env)(fpUtils.validateOutput(pluginName, output));
