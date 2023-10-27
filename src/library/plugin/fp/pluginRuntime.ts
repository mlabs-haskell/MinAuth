import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { Decoder, EncodeDecoder } from './EncodeDecoder';
import { FpInterfaceType } from './interfaceKind';
import { IMinAuthPlugin, Logger } from './pluginType';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { launchTE } from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';

export type PluginRuntimeEnv = Readonly<{
  logger: Logger;
  plugins: ActivePlugins;
}>;

export type RuntimePluginInstance = IMinAuthPlugin<
  FpInterfaceType,
  unknown,
  unknown
> & {
  publicInputArgsDec: Decoder<FpInterfaceType, unknown>;
  outputEncDec: EncodeDecoder<FpInterfaceType, unknown>;
};

export type ActivePlugins = Readonly<Record<string, RuntimePluginInstance>>;

export type PluginRuntime<Ret> = ReaderTaskEither<
  PluginRuntimeEnv,
  string,
  Ret
>;

export const useLogger = (f: (l: Logger) => void): PluginRuntime<void> =>
  pipe(
    askLogger(),
    RTE.chain((logger) => RTE.fromIO(() => f(logger)))
  );

export const askLogger = (): PluginRuntime<Logger> =>
  RTE.asks(({ logger }: PluginRuntimeEnv) => logger);

export const askActivePlugins = (): PluginRuntime<ActivePlugins> =>
  RTE.asks(({ plugins }: PluginRuntimeEnv) => plugins);

export const askPluginInstance = (
  pluginName: string
): PluginRuntime<RuntimePluginInstance> =>
  pipe(
    askActivePlugins(),
    RTE.chain((plugins) =>
      RTE.fromOption(() => `plugin ${pluginName} not found`)(
        R.lookup(pluginName)(plugins)
      )
    )
  );

export const askPluginRuntimeEnv = (): PluginRuntime<PluginRuntimeEnv> =>
  RTE.ask();

export const launchPluginRuntime =
  (env: PluginRuntimeEnv) =>
  <Ret>(a: PluginRuntime<Ret>): Promise<Ret> =>
    launchTE(a(env));

export const tapAndLogError = <RET>(
  note: string
): ((_: PluginRuntime<RET>) => PluginRuntime<RET>) =>
  RTE.tapError((err) => useLogger((logger) => logger.error(note, err)));
