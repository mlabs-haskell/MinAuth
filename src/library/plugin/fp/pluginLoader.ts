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

export const configurationSchema = z.object({
  pluginDir: z.string().optional(),
  plugins: z.record(
    z.object({
      path: z.string().optional(),
      config: z.unknown()
    })
  )
});

export type Configuration = z.infer<typeof configurationSchema>;

// TODO: this is more like a general purpose utility to me. Might consider move
// it to a dedicate module.
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
        liftZodParseResult(parseConfiguration(cfgFileContent))
      )
    );

export const readConfiguration = (logger: Logger) =>
  _readConfiguration(logger)(configurationSchema.safeParse);

export type UntypedFpPluginFactory = IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
  unknown
>;

export type UntypedTsPluginFactory = IMinAuthPluginFactory<
  TsInterfaceType,
  IMinAuthPlugin<TsInterfaceType, unknown, unknown>,
  unknown
>;

export type UntypedPluginFactory =
  | UntypedFpPluginFactory
  | UntypedTsPluginFactory;

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
      TE.bind('initLogger', () => mkLogger('pluginLoader')),
      TE.bind('pluginsLogger', () => mkLogger('activePlugins')),
      TE.bind('runtimeLogger', () => mkLogger('pluginRuntime')),
      TE.bind('plugins', ({ initLogger, pluginsLogger }) =>
        R.traverseWithIndex(Applicative)(
          resolveModulePathAndInitializePlugin(initLogger, pluginsLogger)
        )(cfg.plugins)
      ),
      TE.map(({ plugins, runtimeLogger }): PluginRuntimeEnv => {
        return { logger: runtimeLogger, plugins };
      })
    );
  };
