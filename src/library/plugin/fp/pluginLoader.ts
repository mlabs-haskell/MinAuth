import * as path from 'path';
import {
  FpInterfaceType,
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
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
  IProofCache,
  IProofCacheProvider,
  toTsCheckCachedProof
} from './proofCache';

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

export const _readConfiguration =
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

          console.log(`reading configuration from ${finalCfgPath}`);

          return existsSync(finalCfgPath)
            ? E.right(finalCfgPath)
            : E.left('configuration file does not exists');
        })
      ),
      TE.bind('cfgFileContent', ({ finalCfgPath }) =>
        fromFailablePromise<string>(() => fs.readFile(finalCfgPath, 'utf-8'))
      ),
      TE.chain(({ cfgFileContent }) =>
        liftZodParseResult(parseConfiguration(cfgFileContent))
      )
    );

export const readConfiguration = _readConfiguration(
  configurationSchema.safeParse
);

//

export interface UntypedPluginInstance
  extends IMinAuthPlugin<FpInterfaceType, unknown, unknown> {}

export type UntypedPluginFactory =
  | IMinAuthPluginFactory<
      IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
      FpInterfaceType,
      unknown,
      unknown,
      unknown
    >
  | IMinAuthPluginFactory<
      IMinAuthPlugin<TsInterfaceType, unknown, unknown>,
      TsInterfaceType,
      unknown,
      unknown,
      unknown
    >;

export type UntypedPluginModule = { default: UntypedPluginFactory };

export type ActivePlugins = Record<string, UntypedPluginInstance>;

const importPluginModule = (
  pluginModulePath: string
): TaskEither<string, UntypedPluginModule> =>
  fromFailablePromise(() => import(pluginModulePath));

const validatePluginCfg = (
  cfg: unknown,
  factory: UntypedPluginFactory
): TaskEither<string, unknown> =>
  liftZodParseResult(factory.configurationSchema.safeParse(cfg));

const initializePlugin = (
  pluginModulePath: string,
  pluginCfg: unknown,
  proofCache: IProofCache
): TaskEither<string, UntypedPluginInstance> =>
  pipe(
    TE.Do,
    TE.bind('pluginModule', () => importPluginModule(pluginModulePath)),
    TE.let('pluginFactory', ({ pluginModule }) => pluginModule.default),
    TE.bind('typedPluginCfg', ({ pluginFactory }) =>
      validatePluginCfg(pluginCfg, pluginFactory)
    ),
    TE.chain(
      ({
        pluginFactory,
        typedPluginCfg
      }): TaskEither<string, UntypedPluginInstance> =>
        pluginFactory.__interface_tag === fpInterfaceTag
          ? pluginFactory.initialize(typedPluginCfg, proofCache.checkEachProof)
          : pluginFactory.__interface_tag === tsInterfaceTag
          ? pipe(
              fromFailablePromise(() =>
                pluginFactory.initialize(
                  typedPluginCfg,
                  toTsCheckCachedProof(proofCache.checkEachProof)
                )
              ),
              TE.map(
                (obj): UntypedPluginInstance => ({
                  __interface_tag: fpInterfaceTag,
                  verifyAndGetOutput: (pia, sp) =>
                    fromFailablePromise(() => obj.verifyAndGetOutput(pia, sp)),
                  publicInputArgsSchema: obj.publicInputArgsSchema,
                  customRoutes: obj.customRoutes,
                  verificationKey: obj.verificationKey
                })
              )
            )
          : // TODO This check should be moved to `importPluginModule`
            TE.throwError('invalid plugin module')
    )
  );

export const initializePlugins = (
  cfg: Configuration,
  proofCacheProvider: IProofCacheProvider
): TaskEither<string, ActivePlugins> => {
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

  const resolveModulePathAndInitializePlugin = (
    pluginName: string,
    pluginCfg: {
      path?: string | undefined;
      config?: unknown;
    }
  ): TaskEither<string, UntypedPluginInstance> =>
    pipe(
      TE.Do,
      TE.bind('modulePath', () =>
        TE.fromIO(resolvePluginModulePath(pluginName, pluginCfg.path))
      ),
      TE.tapIO(({ modulePath }) => () => {
        console.info(`loading plugin ${pluginName} from ${modulePath}`);
        console.log(pluginCfg.config);
      }),
      TE.tap(() => proofCacheProvider.initCacheFor(pluginName)),
      TE.bind('proofCache', () => proofCacheProvider.getCacheOf(pluginName)),
      TE.chain(({ modulePath, proofCache }) =>
        initializePlugin(modulePath, pluginCfg.config ?? {}, proofCache)
      ),
      TE.mapLeft(
        (err) => `error while initializing plugin ${pluginName}: ${err}`
      )
    );

  const Applicative = TE.getApplicativeTaskValidation(
    T.ApplyPar,
    pipe(Str.Semigroup, S.intercalate(', '))
  );

  return R.traverseWithIndex(Applicative)(resolveModulePathAndInitializePlugin)(
    cfg.plugins
  );
};
