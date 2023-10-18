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
  FpInterfaceType,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
} from './interfaceKind';
import { Decoder, EncodeDecoder } from './EncodeDecoder';

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

export type RuntimePluginInstance = IMinAuthPlugin<
  FpInterfaceType,
  unknown,
  unknown
> & {
  publicInputArgsDec: Decoder<FpInterfaceType, unknown>;
  outputEncDec: EncodeDecoder<FpInterfaceType, unknown>;
};

export type ActivePlugins = Record<string, RuntimePluginInstance>;

const importPluginModule = (
  pluginModulePath: string
): TaskEither<string, UntypedPluginModule> =>
  fromFailablePromise(() => import(pluginModulePath));

const validatePluginCfg = (
  cfg: unknown,
  factory: IMinAuthPluginFactory<
    FpInterfaceType,
    IMinAuthPlugin<FpInterfaceType, unknown, unknown>,
    unknown,
    unknown,
    unknown
  >
): TaskEither<string, unknown> =>
  TE.fromEither(factory.configurationDec.decode(cfg));

const initializePlugin = (
  pluginModulePath: string,
  pluginCfg: unknown
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
      pluginFactory.initialize(typedPluginCfg)
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

export const initializePlugins = (
  cfg: Configuration
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
  ): TaskEither<string, RuntimePluginInstance> =>
    pipe(
      TE.Do,
      TE.bind('modulePath', () =>
        TE.fromIO(resolvePluginModulePath(pluginName, pluginCfg.path))
      ),
      TE.tapIO(({ modulePath }) => () => {
        console.info(`loading plugin ${pluginName} from ${modulePath}`);
        console.log(pluginCfg.config);
      }),
      TE.chain(({ modulePath }) =>
        initializePlugin(modulePath, pluginCfg.config ?? {})
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
