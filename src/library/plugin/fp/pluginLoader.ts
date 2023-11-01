import * as path from 'path';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  Logger,
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
import { fromFailablePromise, liftZodParseResult } from '@utils/fp/TaskEither';
import {
  FpInterfaceType,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
} from './interfaceKind';
import { PluginRuntimeEnv, RuntimePluginInstance } from './pluginRuntime';

/**
 * Configuration schema for the plugin loader
 */
export const configurationSchema = z.object({
  /** Directory where to look for plugins */
  pluginDir: z.string().optional(),

  /** Plugins to load along with their configuration */
  plugins: z.record(
    z.object({
      /** Path to the plugin module */
      path: z.string().optional(),

      /** Configuration for the plugin */
      config: z.unknown()
    })
  )
});

/**
 * Type of the plugins configuration.
 */
export type Configuration = z.infer<typeof configurationSchema>;

/**
 * Read the configuration from a file with custom parser
 */
export const _readConfiguration =
  (logger: Logger) =>
  <T>(parseConfiguration: (s: string) => z.SafeParseReturnType<T, T>) =>
  (cfgPath?: string): TaskEither<string, T> =>
    pipe(
      TE.Do,
      TE.bind('finalCfgPath', () =>
        TE.fromIOEither(() => {
          const finalCfgPath = path.resolve(
            cfgPath ??
              env.get('MINAUTH_CONFIG').default('config.yaml').asString()
          );

          logger.debug({ finalCfgPath });

          return existsSync(finalCfgPath)
            ? E.right(finalCfgPath)
            : E.left('configuration file does not exist');
        })
      ),
      TE.bind('cfgFileContent', ({ finalCfgPath }) =>
        fromFailablePromise<string>(() => fs.readFile(finalCfgPath, 'utf-8'))
      ),
      TE.chain(({ cfgFileContent }) =>
        liftZodParseResult(parseConfiguration(JSON.parse(cfgFileContent)))
      )
    );

/** Read the configuration from a file
 *  The file path can be passed from $MINAUTH_CONFIG env var and
 *  defaults to `config.yaml` in the current working directory
 */
export const readConfiguration = (logger: Logger) =>
  _readConfiguration(logger)(configurationSchema.safeParse);

/**
 * The type of a plugin factory used by the library to dynamically load plugins.
 * This factory will create plugins with interfaces in the functional style.
 */
export type UntypedFpPluginFactory = IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
  unknown
>;

/**
 * The type of a plugin factory used by the library to dynamically load plugins.
 * This factory will create plugins with idiomatic typescript interface style.
 */
export type UntypedTsPluginFactory = IMinAuthPluginFactory<
  TsInterfaceType,
  IMinAuthPlugin<TsInterfaceType, unknown, unknown>,
  unknown
>;

/**
 * The type of a plugin factory used by the library to dynamically load plugins.
 * A module that defines a plugin has to export a value of this type.
 * This means that the plugin author may pick either functional or idiomatic typescript interface.
 */
export type UntypedPluginFactory =
  | UntypedFpPluginFactory
  | UntypedTsPluginFactory;

/**
 * The type of a plugin module used by the library to dynamically load plugins.
 * The module can define a plugin with either functional or idiomatic typescript interface.
 */
export type UntypedPluginModule = { default: UntypedPluginFactory };

const importPluginModule = (
  pluginModulePath: string
): TaskEither<string, UntypedPluginModule> =>
  fromFailablePromise(() => import(pluginModulePath));

const validatePluginCfg = (
  cfg: unknown,
  factory: IMinAuthPluginFactory<
    FpInterfaceType,
    IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
    unknown
  >
): TaskEither<string, unknown> =>
  TE.fromEither(factory.configurationDec.decode(cfg));

/**
 * Perform a dynamic import of the plugin module and initialize the plugin.
 */
const initializePlugin = (
  pluginModulePath: string,
  pluginCfg: unknown,
  logger: Logger
): TaskEither<string, RuntimePluginInstance> =>
  pipe(
    TE.Do,
    TE.bind('pluginModule', () => importPluginModule(pluginModulePath)),
    TE.let('rawPluginFactory', ({ pluginModule }) => pluginModule.default),
    TE.bind('pluginFactory', ({ rawPluginFactory }) =>
      rawPluginFactory.__interface_tag === fpInterfaceTag
        ? TE.right(rawPluginFactory)
        : rawPluginFactory.__interface_tag === tsInterfaceTag
        ? TE.right(tsToFpMinAuthPluginFactory(rawPluginFactory))
        : // TODO This check should be moved to `importPluginModule`
          TE.left('invalid plugin module')
    ),
    TE.bind('typedPluginCfg', ({ pluginFactory }) =>
      validatePluginCfg(pluginCfg, pluginFactory)
    ),
    TE.bind('pluginInstance', ({ pluginFactory, typedPluginCfg }) =>
      pluginFactory.initialize(typedPluginCfg, logger)
    ),
    TE.map(({ pluginFactory, pluginInstance }) => {
      return {
        __interface_tag: 'fp',
        // NOTE: non-properties are not getting copied using `...pluginInstance`
        // So we do it manually.
        verifyAndGetOutput: (p, s) => pluginInstance.verifyAndGetOutput(p, s),
        checkOutputValidity: (o) => pluginInstance.checkOutputValidity(o),
        customRoutes: pluginInstance.customRoutes,
        verificationKey: pluginInstance.verificationKey,
        publicInputArgsDec: pluginFactory.publicInputArgsDec,
        outputEncDec: pluginFactory.outputEncDec
      };
    })
  );

/**
 * Given a logger and plugin configuration, initialize the plugins.
 * Provided plugins will be transformed to the functional style interface,
 * to used as such by the library.
 */
export const initializePlugins =
  (
    // the root logger of the hierarchy
    rootLogger: Logger
  ) =>
  (cfg: Configuration): TaskEither<string, PluginRuntimeEnv> => {
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
      (initLogger: Logger, pluginsLogger: Logger) =>
      (
        pluginName: string,
        pluginCfg: {
          path?: string | undefined;
          config?: unknown;
        }
      ): TaskEither<string, RuntimePluginInstance> =>
        pipe(
          TE.Do,
          TE.bind('modulePath', () =>
            TE.fromIO(resolvePluginModulePath(pluginName, pluginCfg.path))
          ),
          TE.let(
            // The configuration object passed to the `initialize` function of the plugin factory
            'pluginConfig',
            () => pluginCfg.config ?? {}
          ),
          TE.tapIO(({ modulePath, pluginConfig }) => () => {
            initLogger.info(`loading plugin ${pluginName}`);
            initLogger.debug({
              pluginName,
              modulePath,
              pluginConfig
            });
          }),
          TE.bind('pluginLogger', () =>
            TE.fromIO(() =>
              pluginsLogger.getSubLogger({
                name: `${pluginName}`
              })
            )
          ),
          TE.chain(({ modulePath, pluginConfig, pluginLogger }) =>
            initializePlugin(modulePath, pluginConfig, pluginLogger)
          ),
          TE.mapLeft(
            // TODO: more structural error?
            (err) => `error while initializing plugin ${pluginName}: ${err}`
          ),
          TE.tapError((err) =>
            TE.fromIO(() =>
              initLogger.error(`unable to initialize plugin ${pluginName}`, err)
            )
          )
        );

    const Applicative = TE.getApplicativeTaskValidation(
      T.ApplyPar,
      pipe(Str.Semigroup, S.intercalate(', '))
    );

    const mkLogger = (name: string) =>
      TE.fromIO(() => rootLogger.getSubLogger({ name }));

    return pipe(
      TE.Do,
      // A dedicated logger for the plugin initilization process
      TE.bind('initLogger', () => mkLogger('pluginLoader')),
      // Plugin runtime "manages" plugins and knows nothing about
      // what happens in each plugin, used to log events happen inside the
      // PluginRuntime monad.
      TE.bind('pluginsLogger', () => mkLogger('activePlugins')),
      // Plugins should use the provided logger to log the events
      // that happen inside the plugin, like the detail of the verification process.
      TE.bind('runtimeLogger', () => mkLogger('pluginRuntime')),
      // Initialize each plugin
      TE.bind('plugins', ({ initLogger, pluginsLogger }) =>
        R.traverseWithIndex(Applicative)(
          resolveModulePathAndInitializePlugin(initLogger, pluginsLogger)
        )(cfg.plugins)
      ),
      // lift results
      TE.map(({ plugins, runtimeLogger }): PluginRuntimeEnv => {
        return { logger: runtimeLogger, plugins };
      })
    );
  };
