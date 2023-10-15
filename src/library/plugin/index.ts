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
export * from './fp/interfaceKind';

export const readConfiguration = (cfgPath?: string): Promise<Configuration> =>
  launchTE(fpPluginLoader.readConfiguration(cfgPath));

export const initializePlugins = (
  cfg: Configuration,
  proofCacheProvider: fpPluginLoader.ProofCacheProvider
): Promise<ActivePlugins> =>
  launchTE(fpPluginLoader.initializePlugins(cfg, proofCacheProvider));

export const installCustomRoutes = (
  activePlugins: ActivePlugins,
  app: expressCore.Express
): Promise<void> => launchTE(fpUtils.installCustomRoutes(activePlugins)(app));

export const verifyProof = (
  activePlugins: ActivePlugins,
  proofCacheProvider: fpPluginLoader.ProofCacheProvider,
  proof: JsonProof,
  publicInputArgs: unknown,
  pluginName: string
) =>
  launchTE(
    fpUtils.verifyProof(activePlugins, proofCacheProvider)(
      proof,
      publicInputArgs,
      pluginName
    )
  );
