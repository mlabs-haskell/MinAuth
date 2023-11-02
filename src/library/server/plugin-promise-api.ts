import { Configuration } from './plugin-fp-api';
import * as fpPlugin from './plugin-fp-api';
import * as expressCore from 'express-serve-static-core';
import { JsonProof } from 'o1js';
import { launchTE } from '@lib/utils/fp/taskeither';
import { OutputValidity } from '@lib/plugin/plugintype';

export * from '@lib/plugin/plugintype';
export {
  configurationSchema,
  Configuration,
  UntypedPluginFactory,
  UntypedPluginModule
} from './plugin-fp-api';
export * from '@lib/plugin/interfacekind';
import * as log from 'tslog';
import { PluginRuntimeEnv, launchPluginRuntime } from './pluginruntime';
import { Logger } from '@lib/plugin/logger';
export {
  RuntimePluginInstance,
  PluginRuntimeEnv,
  ActivePlugins
} from './pluginruntime';

const defaultRootLoggerConfiguration: log.ISettingsParam<log.ILogObj> = {
  name: 'minauth-plugin-system',
  type: 'pretty',
  minLevel: 2 // debug
};

const defaultRootLogger: Logger = new log.Logger(
  defaultRootLoggerConfiguration
);

/** Read the configuration from a file
 *  The file path can be passed from $MINAUTH_CONFIG env var and
 *  defaults to `config.yaml` in the current working directory
 */
export const readConfiguration = (
  cfgPath?: string,
  logger: Logger = defaultRootLogger
): Promise<Configuration> =>
  launchTE(fpPlugin.readConfiguration(logger)(cfgPath));

/**
 * Given a logger and plugin configuration, initialize the plugins.
 * Provided plugins will be transformed to the functional style interface,
 * to used as such by the library.
 */
export const initializePlugins = (
  cfg: Configuration,
  logger: Logger = defaultRootLogger
): Promise<PluginRuntimeEnv> =>
  launchTE(fpPlugin.initializePlugins(logger)(cfg));

/**
 * Install custom routes for all the active plugins.
 * The routes are installed under `/plugins/${pluginName}`.
 * and come from `pluginInstance.customRoutes`.
 * The routes are meant for plugin / prover communication.
 */
export const installCustomRoutes = (
  env: PluginRuntimeEnv,
  app: expressCore.Express
): Promise<void> => launchPluginRuntime(env)(fpPlugin.installCustomRoutes(app));

/**
 * Verify proof with given plugin and return its output.
 */
export const verifyProof = (
  env: PluginRuntimeEnv,
  proof: JsonProof,
  publicInputArgs: unknown,
  pluginName: string
): Promise<unknown> =>
  launchPluginRuntime(env)(
    fpPlugin.verifyProof(proof, publicInputArgs, pluginName)
  );

/** Validate the output of a plugin within the active  plugin runtime.
 */
export const validateOutput = (
  env: PluginRuntimeEnv,
  output: unknown,
  pluginName: string
): Promise<OutputValidity> =>
  launchPluginRuntime(env)(fpPlugin.validateOutput(pluginName, output));
