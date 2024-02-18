import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither.js';
import { FpInterfaceType } from '../plugin/interfacekind.js';
import { IMinAuthPlugin } from '../plugin/plugintype.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import * as R from 'fp-ts/lib/Record.js';
import { Logger } from '../plugin/logger.js';
import { launchTE } from '../utils/fp/taskeither.js';

/** Runtime environment of runnning plugins. */
export type PluginRuntimeEnv = Readonly<{
  logger: Logger;
  plugins: ActivePlugins;
}>;

/** The runtime instance of a plugin.
    Basically an extended functional style plugin interface.
*/
export type RuntimePluginInstance = IMinAuthPlugin<
  FpInterfaceType,
  unknown,
  unknown
>;

/** Mapping between plugin names and their runtime instances. */
export type ActivePlugins = Readonly<Record<string, RuntimePluginInstance>>;

/**
 * The plugin runtime monad. Actions are TaskEither's (fallible async calls)
 * that can read the PluginRuntimeEnv.
 * Errors are strings.
 */
export type PluginRuntime<Ret> = ReaderTaskEither<
  PluginRuntimeEnv,
  string,
  Ret
>;

/**
 * Use the plugin runtime logger.
 */
export const useLogger = (f: (l: Logger) => void): PluginRuntime<void> =>
  pipe(
    askLogger(),
    RTE.chain((logger) => RTE.fromIO(() => f(logger)))
  );

/**
 * Get the plugin runtime logger instance.
 */
export const askLogger = (): PluginRuntime<Logger> =>
  RTE.asks(({ logger }: PluginRuntimeEnv) => logger);

/**
 * Get all active plugin instances.
 */
export const askActivePlugins = (): PluginRuntime<ActivePlugins> =>
  RTE.asks(({ plugins }: PluginRuntimeEnv) => plugins);

/**
 * Get a running plugin instance by its name.
 */
export const askPluginInstance = (
  pluginName: string
): PluginRuntime<RuntimePluginInstance> =>
  pipe(
    RTE.Do,
    RTE.bind('plugins', () => askActivePlugins()),
    RTE.let('activePluginNames', ({ plugins }) => Object.keys(plugins)),
    RTE.chain(({ plugins, activePluginNames }) =>
      RTE.fromOption(
        () =>
          `plugin ${pluginName} not found. Available plugins ${activePluginNames}`
      )(R.lookup(pluginName)(plugins))
    )
  );

export const askActivePluginNames = (): PluginRuntime<string[]> =>
  pipe(
    RTE.Do,
    RTE.bind('plugins', () => askActivePlugins()),
    RTE.map(({ plugins }) => Object.keys(plugins))
  );

/**
 * Get the plugin runtime environment.
 */
export const askPluginRuntimeEnv = (): PluginRuntime<PluginRuntimeEnv> =>
  RTE.ask();

/**
 * Launch a plugin runtime action as a TS promise.
 */
export const launchPluginRuntime =
  (env: PluginRuntimeEnv) =>
  <Ret>(a: PluginRuntime<Ret>): Promise<Ret> =>
    launchTE(a(env));

/**
 * Tap into the error of a plugin runtime action and log it with
 * an additional note.
 */
export const tapAndLogError = <RET>(
  note: string
): ((_: PluginRuntime<RET>) => PluginRuntime<RET>) =>
  RTE.tapError((err) => useLogger((logger) => logger.error(note, err)));
