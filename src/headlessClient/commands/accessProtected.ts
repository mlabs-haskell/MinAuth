import * as cmd from 'cmd-ts';
import {
  CommandHandler,
  CommonOptions,
  asCmdTsHandlerFunction,
  commonOptions,
  liftAction,
  readJwt
} from './common';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { accessProtectedAction } from '../actions';

const args = {
  ...commonOptions,
  protectedPath: cmd.option({
    type: cmd.string,
    long: 'protected path',
    defaultValue: () => '/protected'
  })
};

type Options = CommonOptions & {
  protectedPath: string;
};

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
