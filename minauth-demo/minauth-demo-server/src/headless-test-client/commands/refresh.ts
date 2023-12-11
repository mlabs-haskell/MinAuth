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
} from './common.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import { refreshAction } from '../actions.js';

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
