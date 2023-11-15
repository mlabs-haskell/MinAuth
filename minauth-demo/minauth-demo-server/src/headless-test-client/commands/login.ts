import * as cmd from 'cmd-ts';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as R from 'fp-ts/Record';
import { pipe } from 'fp-ts/function';

import MerkleMembershipsGenerator from 'minauth-merkle-membership-plugin/proofgenerator';
import SimplePreImageGenerator from 'minauth-simple-preimage-plugin/proofgenerator';

import { loginAction } from '../actions';
import {
  UntypedProofGenerator,
  asUntypedProofGenerator
} from 'minauth/plugin/proofgenerator';
import {
  CommandHandler,
  CommonOptions,
  asCmdTsHandlerFunction,
  askOpt,
  commonOptions,
  liftAction,
  readFile,
  writeJwt,
  writeRefreshToken
} from './common';

/** The available proof generators */
const proofGenerators: Record<string, UntypedProofGenerator> = {
  'simple-preimage': asUntypedProofGenerator(SimplePreImageGenerator),
  'merkle-memberships': asUntypedProofGenerator(MerkleMembershipsGenerator)
};

/** CLI login subcommand arguments */
const args = {
  ...commonOptions,
  proofGeneratorName: cmd.option({
    long: 'proof-generator-name',
    short: 'g',
    type: cmd.string,
    description: 'One of ' + Object.keys(proofGenerators)
  }),
  proofGeneratorConfFile: cmd.option({
    long: 'proof-generator-conf-file',
    short: 'c',
    type: cmd.string
  })
};

/**
 * The command options
 */
type Options = CommonOptions & {
  proofGeneratorName: string;
  proofGeneratorConfFile: string;
};

const lookupProofGenerator = (): CommandHandler<
  Options,
  UntypedProofGenerator
> =>
  pipe(
    askOpt<'proofGeneratorName', Options>('proofGeneratorName'),
    RTE.chain((generatorName: string) =>
      RTE.fromOption(() => `missing proof generator: ${generatorName}`)(
        R.lookup(generatorName)(proofGenerators)
      )
    )
  );

const decodeProofGeneratorConfig =
  (generator: UntypedProofGenerator) =>
  (untypedConfig: unknown): CommandHandler<Options, unknown> =>
    pipe(
      RTE.fromEither(generator.confDec.decode(untypedConfig)),
      RTE.mapLeft(
        (err: string) => `unable to decode proof generator config: ${err}`
      )
    );

/**
 * The login command handler. It:
 * - reads the proof generator configuration from a file
 *
 */
const handler = (): CommandHandler<Options, void> =>
  pipe(
    RTE.Do,
    RTE.bind('proofGenerator', lookupProofGenerator),
    RTE.bind('typedGeneratorConfig', ({ proofGenerator }) =>
      pipe(
        askOpt<'proofGeneratorConfFile', Options>('proofGeneratorConfFile'),
        RTE.chain(readFile<Options>),
        RTE.map(JSON.parse),
        RTE.chain(decodeProofGeneratorConfig(proofGenerator))
      )
    ),
    RTE.bind('actionResult', ({ proofGenerator, typedGeneratorConfig }) =>
      liftAction(loginAction(proofGenerator, typedGeneratorConfig))
    ),
    RTE.tap(({ actionResult: { token, refreshToken } }) =>
      pipe(
        writeJwt(token),
        RTE.chain(() => writeRefreshToken(refreshToken))
      )
    ),
    RTE.asUnit
  );

const name: string = 'login';

const description: string = 'Try a login action using selected plugin.';

/** Export login command */
export const command = cmd.command({
  name,
  description,
  args,
  handler: asCmdTsHandlerFunction(name, handler)
});

export default command;
