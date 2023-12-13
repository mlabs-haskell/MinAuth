import * as cmd from 'cmd-ts';
import {
  CommandHandler,
  CommonOptions,
  asCmdTsHandlerFunction,
  commonOptions,
  liftAction,
  readJwt
} from './common.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import { accessProtectedAction } from '../actions.js';

/** CLI refresh subcommand arguments */
const args = {
  ...commonOptions,
  /** The route of the protected resource to access */
  protectedPath: cmd.option({
    type: cmd.string,
    long: 'protected path',
    defaultValue: () => '/protected'
  })
};

type Options = CommonOptions & {
  protectedPath: string;
};

/**
 * The command handler for the access-protected action
 */
const handler = (): CommandHandler<Options, void> =>
  pipe(
    readJwt(),
    RTE.chain((jwt) => liftAction(accessProtectedAction(jwt))),
    RTE.asUnit
  );

const name: string = 'accessProtected';

export const command = cmd.command({
  name,
  args,
  handler: asCmdTsHandlerFunction(name, handler)
});

export default command;
