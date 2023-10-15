import * as path from 'path';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  tsToFpMinAuthPluginFactory
} from './pluginType';
import * as R from 'fp-ts/Record';
import { pipe } from 'fp-ts/function';
import { TaskEither } from 'fp-ts/TaskEither';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as Str from 'fp-ts/string';
import * as S from 'fp-ts/Semigroup';
import { z } from 'zod';
import env from 'env-var';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { fromPromise, liftZodParseResult } from '@utils/fp/TaskEither';
import {
  IProofCache,
  IProofCacheProvider,
  tsToFpProofCacheProvider
} from './proofCache';
import {
  FpInterfaceType,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
} from '@lib/common/interfaceKind';

/**
 * Configuration schema for the plugin loader
 */
export const configurationSchema = z.object({
  // Directory where to look for plugins
  pluginDir: z.string().optional(),
  // Plugins to load along with their configuration
  plugins: z.record(
    z.object({
      // Path to the plugin module
      path: z.string().optional(),
      // Configuration for the plugin
      config: z.unknown()
    })
  )
});

/**
 * Type of the plugins configuration.
 */
export type Configuration = z.infer<typeof configurationSchema>;

/**
 * An auxilliary type to represent a proof cache provider irrespectively of the
 * plugin interface kind.
 */
export type ProofCacheProvider =
  | IProofCacheProvider<FpInterfaceType>
  | IProofCacheProvider<TsInterfaceType>;

/**
 * Given plugin configuration and a proof cache, initialize the plugins.
 * Provided plugins will be transformed to the functional style interface,
 * to used as such by the library.
 */
export const initializePlugins = (
  cfg: Configuration,
  rawProofCacheProvider: ProofCacheProvider
): TaskEither<string, ActivePlugins> => {
  // convert the proof cache provider to the functional style interface
  const proofCacheProvider: TaskEither<
    string,
    IProofCacheProvider<FpInterfaceType>
  > = rawProofCacheProvider.__interface_tag == fpInterfaceTag
    ? TE.right(rawProofCacheProvider)
    : rawProofCacheProvider.__interface_tag == tsInterfaceTag
    ? TE.right(tsToFpProofCacheProvider(rawProofCacheProvider))
    : TE.left('proof cache provider: unknown interface type');

  // plugin module path resolver based on the configuration
  const resolvePluginModulePath =
    (name: string, optionalPath?: string) => () => {
      const dir =
        cfg.pluginDir === undefined
          ? process.cwd()
          : path.resolve(cfg.pluginDir);

      return optionalPath === undefined
        ? path.join(dir, name)
        : path.resolve(optionalPath);
    };

  const resolveModulePathAndInitializePlugin =
    // For given proof cache


      (proofCacheProvider: IProofCacheProvider<FpInterfaceType>) =>
      // get a function that given a plugin name and configuration initializes and loads a plugin
      (
        pluginName: string,
        pluginCfg: {
          path?: string | undefined;
          config?: unknown;
        }
      ): TaskEither<string, UntypedPlugin> =>
        pipe(
          TE.Do,
          // resolve the plugin module path
          TE.bind('modulePath', () =>
            TE.fromIO(resolvePluginModulePath(pluginName, pluginCfg.path))
          ),
          TE.tapIO(({ modulePath }) => () => {
            console.info(`loading plugin ${pluginName} from ${modulePath}`);
            console.log(pluginCfg.config);
          }),
          // initialize the cache for the plugin
          TE.tap(() => proofCacheProvider.initCacheFor(pluginName)),
          TE.bind('proofCache', () =>
            proofCacheProvider.getCacheOf(pluginName)
          ),
          // having resolved the module path and initialized the cache, initialize the plugin
          TE.chain(({ modulePath, proofCache }) =>
            initializePlugin(modulePath, pluginCfg.config ?? {}, proofCache)
          ),
          TE.mapLeft(
            (err) => `error while initializing plugin ${pluginName}: ${err}`
          )
        );

  // Select a way to combine errors
  const Applicative = TE.getApplicativeTaskValidation(
    T.ApplyPar,
    pipe(Str.Semigroup, S.intercalate(', '))
  );

  // Use the above functions to initialize all plugins.
  // If any of the plugins fails to initialize, the whole process fails.
  // The errors are concatenated with a comma
  return pipe(
    proofCacheProvider,
    TE.chain((pcp) =>
      R.traverseWithIndex(Applicative)(
        resolveModulePathAndInitializePlugin(pcp)
      )(cfg.plugins)
    )
  );
};

/**
 * Read the configuration from a file with custom parser
 */
export const _readConfiguration =
  <T>(parseConfiguration: (s: string) => z.SafeParseReturnType<T, T>) =>
  (cfgPath?: string): TaskEither<string, T> =>
    pipe(
      TE.Do,
      TE.bind('finalCfgPath', () =>
        TE.fromIOEither(() => {
          // Build configuration location path
          const finalCfgPath = path.resolve(
            cfgPath ??
              env.get('MINAUTH_CONFIG').default('config.yaml').asString()
          );

          console.log(`reading configuration from ${finalCfgPath}`);

          // Error out if the configuration file does not exists
          return existsSync(finalCfgPath)
            ? E.right(finalCfgPath)
            : E.left('configuration file does not exists');
        })
      ),
      // read the configuration file
      TE.bind('cfgFileContent', ({ finalCfgPath }) =>
        fromPromise<string>(() => fs.readFile(finalCfgPath, 'utf-8'))
      ),
      // parse the configuration file according to the schema
      TE.chain(({ cfgFileContent }) =>
        liftZodParseResult(parseConfiguration(cfgFileContent))
      )
    );

/** Read the configuration from a file
 *  The file path can be passed from $MINAUTH_CONFIG env var and
 *  defaults to `config.yaml` in the current working directory
 */
export const readConfiguration = _readConfiguration(
  configurationSchema.safeParse
);

/**
 * The type of a plugin used by the library after dynamic loading.
 */
export interface UntypedPlugin
  extends IMinAuthPlugin<FpInterfaceType, unknown, unknown> {}

/**
 * The type of a plugin module used by the library to dynamically load plugins.
 * The module can define a plugin with either functional or idiomatic typescript interface.
 */
export type UntypedPluginModule = { default: UntypedPluginFactory };

/**
 * The type of a plugin factory used by the library to dynamically load plugins.
 * A module that defines a plugin has to export a value of this type.
 * This means that the plugin author may pick either functional or idiomatic typescript interface.
 */
export type UntypedPluginFactory =
  | IMinAuthPluginFactory<
      FpInterfaceType,
      IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
      unknown,
      unknown,
      unknown
    >
  | IMinAuthPluginFactory<
      TsInterfaceType,
      IMinAuthPlugin<TsInterfaceType, unknown, unknown>,
      unknown,
      unknown,
      unknown
    >;

/**
 * An auxilliary type to represent loaded plugins.
 */
export type ActivePlugins = Record<string, UntypedPlugin>;

// dynamic plugin loading
const initializePlugin = (
  pluginModulePath: string,
  pluginCfg: unknown,
  proofCache: IProofCache<FpInterfaceType>
): TaskEither<string, UntypedPlugin> =>
  pipe(
    TE.Do,
    // import plugin module
    TE.bind('pluginModule', () => importPluginModule(pluginModulePath)),
    TE.let('rawPluginFactory', ({ pluginModule }) => pluginModule.default),
    // validate plugin config
    TE.bind('typedPluginCfg', ({ rawPluginFactory }) =>
      validatePluginCfg(pluginCfg, rawPluginFactory)
    ),
    // convert the plugin factory to the functional style interface
    TE.bind('pluginFactory', ({ rawPluginFactory }) =>
      rawPluginFactory.__interface_tag === fpInterfaceTag
        ? TE.right(rawPluginFactory)
        : rawPluginFactory.__interface_tag === tsInterfaceTag
        ? TE.right(tsToFpMinAuthPluginFactory(rawPluginFactory))
        : // TODO This check should be moved to `importPluginModule`
          TE.left('invalid plugin module')
    ),
    TE.chain(
      ({ pluginFactory, typedPluginCfg }): TaskEither<string, UntypedPlugin> =>
        // initialize the plugin with a proof cache and its configuration
        pluginFactory.initialize(typedPluginCfg, proofCache.checkEachProof)
    )
  );

const importPluginModule = (
  pluginModulePath: string
): TaskEither<string, UntypedPluginModule> =>
  fromPromise(() => import(pluginModulePath));

const validatePluginCfg = (
  cfg: unknown,
  factory: UntypedPluginFactory
): TaskEither<string, unknown> =>
  liftZodParseResult(factory.configurationSchema.safeParse(cfg));
