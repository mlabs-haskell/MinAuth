import { ActivePlugins, Configuration } from './fp/pluginLoader';
import * as fpPluginLoader from './fp/pluginLoader';
import * as expressCore from 'express-serve-static-core';
import * as fpUtils from './fp/utils';
import { JsonProof } from 'o1js';
import { launchTE } from '@utils/fp/TaskEither';
import { IProofCacheProvider } from './fp/proofCache';

export * from './fp/pluginType';
export {
  configurationSchema,
  Configuration,
  UntypedPluginInstance,
  UntypedPluginFactory,
  UntypedPluginModule,
  ActivePlugins
} from './fp/pluginLoader';
export {
  IProofCacheProvider,
  InMemoryProofCacheProvider
} from './fp/proofCache';

export const readConfiguration = (cfgPath?: string): Promise<Configuration> =>
  launchTE(fpPluginLoader.readConfiguration(cfgPath));

export const initializePlugins = (
  cfg: Configuration,
  proofCacheProvider: IProofCacheProvider
): Promise<ActivePlugins> =>
  launchTE(fpPluginLoader.initializePlugins(cfg, proofCacheProvider));

export const installCustomRoutes = (
  activePlugins: ActivePlugins,
  app: expressCore.Express
): Promise<void> => launchTE(fpUtils.installCustomRoutes(activePlugins)(app));

export const verifyProof = (
  activePlugins: ActivePlugins,
  proof: JsonProof,
  publicInputArgs: unknown,
  pluginName: string
) =>
  launchTE(
    fpUtils.verifyProof(activePlugins)(proof, publicInputArgs, pluginName)
  );
