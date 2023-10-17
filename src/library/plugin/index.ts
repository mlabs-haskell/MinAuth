import { ActivePlugins, Configuration } from './fp/pluginLoader';
import * as fpPluginLoader from './fp/pluginLoader';
import * as expressCore from 'express-serve-static-core';
import * as fpUtils from './fp/utils';
import { JsonProof } from 'o1js';
import { launchTE } from '@utils/fp/TaskEither';

export * from './fp/pluginType';
export {
  configurationSchema,
  Configuration,
  UntypedPlugin,
  UntypedPluginFactory,
  UntypedPluginModule,
  ActivePlugins,
  ProofCacheProvider
} from './fp/pluginLoader';
export {
  IProofCacheProvider,
  InMemoryProofCacheProvider,
  ProofKey
} from './fp/proofCache';

/** Read the configuration from a file
 *  The file path can be passed from $MINAUTH_CONFIG env var and
 *  defaults to `config.yaml` in the current working directory
 */
export const readConfiguration = (cfgPath?: string): Promise<Configuration> =>
  launchTE(fpPluginLoader.readConfiguration(cfgPath));

/**
 * Given plugin configuration and a proof cache provider, initialize the plugins.
 */
export const initializePlugins = (
  cfg: Configuration,
  proofCacheProvider: fpPluginLoader.ProofCacheProvider
): Promise<ActivePlugins> =>
  launchTE(fpPluginLoader.initializePlugins(cfg, proofCacheProvider));

/**
 *  Install custom routes for each active plugin.
 */
export const installCustomRoutes = (
  activePlugins: ActivePlugins,
  app: expressCore.Express
): Promise<void> => launchTE(fpUtils.installCustomRoutes(activePlugins)(app));

/**
 * Given set of plugins, plugin identifier and plugin proof * verification inputs
 * - verify proof, and store and return the plugin output.
 */
export const verifyProof = (
  activePlugins: ActivePlugins,
  proofCacheProvider: fpPluginLoader.ProofCacheProvider,
  proof: JsonProof,
  publicInputArgs: unknown,
  pluginName: string
): Promise<{
  output: unknown;
  proofKey: string;
}> =>
  launchTE(
    fpUtils.verifyProof(activePlugins, proofCacheProvider)(
      proof,
      publicInputArgs,
      pluginName
    )
  );

// TODO DEV NOTE:
// the lib/plugin modules should be required to build a plugin.
// The stuff that is needed to operate them should be exported from the server library.
