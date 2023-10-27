import * as cmd from 'cmd-ts';
import SimplePreImageGenerator from '../proofGenerators/SimplePreimageGenerator';
import MerkleMembershipsGenerator from '../proofGenerators/MerkleMembershipsGenerator';
import * as R from 'fp-ts/Record';
import { pipe } from 'fp-ts/function';
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
import {
  UntypedProofGenerator,
  asUntypedProofGenerator
} from '../ProofGenerator';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { loginAction } from '../actions';

const args = {
  ...commonOptions,
  proofGeneratorName: cmd.option({
    long: 'proof-generator-name',
    short: 'g',
    type: cmd.string
  }),
  proofGeneratorConfFile: cmd.option({
    long: 'proof-generator-conf-file',
    short: 'c',
    type: cmd.string
  })
};

const proofGenerators: Record<string, UntypedProofGenerator> = {
  SimplePreimage: asUntypedProofGenerator(SimplePreImageGenerator),
  MerkleMembership: asUntypedProofGenerator(MerkleMembershipsGenerator)
};

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

export const command = cmd.command({
  name,
  args,
  handler: asCmdTsHandlerFunction(name, handler)
});

export default command;
