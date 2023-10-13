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
import { fromFailablePromise, liftZodParseResult } from '@utils/fp/TaskEither';
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
} from './interfaceKind';

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
  proofCache: IProofCache<FpInterfaceType>
): TaskEither<string, UntypedPluginInstance> =>
  pipe(
    TE.Do,
    TE.bind('pluginModule', () => importPluginModule(pluginModulePath)),
    TE.let('rawPluginFactory', ({ pluginModule }) => pluginModule.default),
    TE.bind('typedPluginCfg', ({ rawPluginFactory }) =>
      validatePluginCfg(pluginCfg, rawPluginFactory)
    ),
    TE.bind('pluginFactory', ({ rawPluginFactory }) =>
      rawPluginFactory.__interface_tag === fpInterfaceTag
        ? TE.right(rawPluginFactory)
        : rawPluginFactory.__interface_tag === tsInterfaceTag
        ? TE.right(tsToFpMinAuthPluginFactory(rawPluginFactory))
        : // TODO This check should be moved to `importPluginModule`
          TE.left('invalid plugin module')
    ),
    TE.chain(
      ({
        pluginFactory,
        typedPluginCfg
      }): TaskEither<string, UntypedPluginInstance> =>
        pluginFactory.initialize(typedPluginCfg, proofCache.checkEachProof)
    )
  );

export type UntypedProofCacheProvider =
  | IProofCacheProvider<FpInterfaceType>
  | IProofCacheProvider<TsInterfaceType>;

export const initializePlugins = (
  cfg: Configuration,
  rawProofCacheProvider: UntypedProofCacheProvider
): TaskEither<string, ActivePlugins> => {
  const proofCacheProvider: TaskEither<
    string,
    IProofCacheProvider<FpInterfaceType>
  > = rawProofCacheProvider.__interface_tag == fpInterfaceTag
    ? TE.right(rawProofCacheProvider)
    : rawProofCacheProvider.__interface_tag == tsInterfaceTag
    ? TE.right(tsToFpProofCacheProvider(rawProofCacheProvider))
    : TE.left('proof cache provider: unknown interface type');

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
    (proofCacheProvider: IProofCacheProvider<FpInterfaceType>) =>
    (
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

  return pipe(
    proofCacheProvider,
    TE.chain((pcp) =>
      R.traverseWithIndex(Applicative)(
        resolveModulePathAndInitializePlugin(pcp)
      )(cfg.plugins)
    )
  );
};
