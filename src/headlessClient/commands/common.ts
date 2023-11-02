import { Logger } from '@lib/plugin';
import * as cmd from 'cmd-ts';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import * as log from 'tslog';
import * as E from 'fp-ts/Either';
import { Action, ActionError } from '../actions';
import { pipe } from 'fp-ts/lib/function';
import {
  askLogger,
  askRecordField,
  tryCatch
} from '@utils/fp/ReaderTaskEither';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as fs from 'fs/promises';

/**
 * Options shared by all commands
 */
export const commonOptions = {
  serverUrl: cmd.option({
    long: 'server-url',
    short: 's',
    type: cmd.string,
    defaultValue: () => 'http://127.0.0.1:3000'
  }),
  jwtFile: cmd.option({
    long: 'jwt-file',
    short: 'j',
    type: cmd.string,
    defaultValue: () => './.fixtures/jwt'
  }),
  refreshTokenFile: cmd.option({
    long: 'refresh-token-file',
    short: 'r',
    type: cmd.string,
    defaultValue: () => './.fixtures/refreshToken'
  }),
  silent: cmd.flag({
    long: 'silent',
    short: 's',
    defaultValue: () => false
  }),
  verbose: cmd.flag({
    long: 'verbose',
    short: 'v',
    defaultValue: () => false
  })
};

/**
 * Type of options shared by all commands
 */
export type CommonOptions = {
  serverUrl: string;
  jwtFile: string;
  refreshTokenFile: string;
  silent: boolean;
  verbose: boolean;
};

/**
 * The data available to the CommandHandler actions.
 */
export type CommandHandlerEnv<Opts extends CommonOptions> = Readonly<{
  logger: Logger;
  opts: Opts;
}>;

/**
 * The command handler monad. Basically fallible async functions with access to
 * the command options and a logger.
 */
export type CommandHandler<Opts extends CommonOptions, T> = ReaderTaskEither<
  CommandHandlerEnv<Opts>,
  string,
  T
>;

export const asCmdTsHandlerFunction =
  <Opts extends CommonOptions, T>(
    commandName: string,
    f: () => CommandHandler<Opts, T>
  ) =>
  async (opts: Opts): Promise<void> => {
    const logger = new log.Logger<log.ILogObj>({
      name: commandName,
      type: opts.silent ? 'hidden' : 'pretty',
      minLevel: opts.verbose ? 2 : 3
    });
    const env: CommandHandlerEnv<Opts> = {
      logger,
      opts
    };
    logger.info(`start executing command ${commandName}`);
    logger.debug('options', opts);
    const res = await f()(env)();
    return E.match(
      (err) => {
        logger.error(
          `error while executing the command ${commandName}: String(${err})`
        );
        process.exit(1);
      },
      () => {
        logger.info('all done');
      }
    )(res);
  };

/**
 * Get the value of the given option from the command options
 * in a type-safe manner.
 */
export const askOpt = <
  P extends string,
  Opts extends { [key in P]: unknown } & CommonOptions
>(
  key: P
): CommandHandler<Opts, Opts[P]> =>
  pipe(
    askRecordField<'opts', CommandHandlerEnv<Opts>>('opts'),
    RTE.map((opts) => opts[key])
  );

/**
 * Lift a program in an Action monad into CommandHandler monad.
 */
export const liftAction = <Opts extends CommonOptions, T>(
  f: Action<T>
): CommandHandler<Opts, T> =>
  pipe(
    RTE.Do,
    RTE.bind('serverUrl', () => askOpt('serverUrl')),
    RTE.bind('logger', () => askLogger()),
    RTE.chain(
      ({ serverUrl, logger }): CommandHandler<Opts, T> =>
        pipe(
          RTE.fromTaskEither(f({ logger, serverUrl })),
          RTE.tapError((err: ActionError) =>
            RTE.fromIO(() => logger.error('failed to perform action', err))
          ),
          RTE.mapLeft((err: ActionError): string => String(err))
        )
    )
  );

/*
 * Command handler level wrapper for the `writeFile` function.
 */
export const writeFile =
  (content: string) =>
  <Opts extends CommonOptions>(path: string): CommandHandler<Opts, void> =>
    tryCatch(
      () => fs.writeFile(path, content, 'utf8'),
      (err) => `unable to write file ${path}: String(${err})`
    );

/*
 * Command handler level wrapper for the `readfile` function.
 */
export const readFile = <Opts extends CommonOptions>(
  path: string
): CommandHandler<Opts, string> =>
  tryCatch(
    () => fs.readFile(path, 'utf-8'),
    (err) => `unable to read file ${path}: String(${err})`
  );

/*
 * Command handler level wrapper to get the jwt file content.
 */
export const readJwt = <Opts extends CommonOptions>(): CommandHandler<
  Opts,
  string
> => pipe(askOpt('jwtFile'), RTE.chain(readFile));

/*
 * Command handler level wrapper to write the jwt file content.
 */
export const writeJwt = <Opts extends CommonOptions>(
  jwt: string
): CommandHandler<Opts, void> =>
  pipe(askOpt('jwtFile'), RTE.chain(writeFile(jwt)));

/*
 * Command handler level wrapper to read the refresh token content.
 */
export const readRefreshToken = <Opts extends CommonOptions>(): CommandHandler<
  Opts,
  string
> => pipe(askOpt('refreshTokenFile'), RTE.chain(readFile));

/*
 * Command handler level wrapper to write the refresh token content.
 */
export const writeRefreshToken = <Opts extends CommonOptions>(
  refreshToken: string
): CommandHandler<Opts, void> =>
  pipe(askOpt('refreshTokenFile'), RTE.chain(writeFile(refreshToken)));
