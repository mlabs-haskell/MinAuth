import * as cmd from 'cmd-ts';
import {
  CommandHandler,
  CommonOptions,
  asCmdTsHandlerFunction,
  commonOptions,
  liftAction,
  readJwt,
  readRefreshToken,
  writeJwt
} from './common';
import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { refreshAction } from '../actions';

/** CLI refresh subcommand arguments */
const args = commonOptions;

type Options = CommonOptions;

/**
 * The command handler for the refresh action
 */
const handler = (): CommandHandler<Options, void> =>
  pipe(
    RTE.Do,
    RTE.bind('jwt', readJwt),
    RTE.bind('refreshToken', readRefreshToken),
    RTE.bind('actionResult', ({ jwt, refreshToken }) =>
      liftAction(refreshAction(jwt, refreshToken))
    ),
    RTE.tap(({ actionResult: { token } }) => writeJwt(token)),
    RTE.asUnit
  );

const name: string = 'refresh';

export const command = cmd.command({
  name,
  args,
  handler: asCmdTsHandlerFunction(name, handler)
});

export default command;
