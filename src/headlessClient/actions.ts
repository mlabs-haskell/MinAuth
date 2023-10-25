import { Logger } from '@lib/plugin/fp/pluginType';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';
import {
  Client,
  ClientEnv,
  ClientError,
  accessProtected,
  login,
  refresh
} from './client';
import {
  GenerateProof,
  GenerateProofEnv,
  GenerateProofError,
  IProofGenerator
} from './ProofGenerator';
import {
  askSublogger,
  tapLogger,
  useLogger,
  withRTE
} from '@utils/fp/ReaderTaskEither';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { pipe } from 'fp-ts/lib/function';

export type ActionEnv = Readonly<{
  logger: Logger;
  serverUrl: string;
}>;

export type ActionError =
  | {
      __tag: 'clientError';
      error: ClientError;
    }
  | {
      __tag: 'proofGenerationError';
      error: GenerateProofError;
    }
  | {
      __tag: 'otherError';
      error: unknown;
    };

export type Action<A> = ReaderTaskEither<ActionEnv, ActionError, A>;

const liftClient = <T>(f: Client<T>): Action<T> =>
  pipe(
    askSublogger('client'),
    RTE.chain((clientLogger) =>
      withRTE(
        (error: ClientError): ActionError => ({
          __tag: 'clientError',
          error
        }),
        ({ serverUrl }: ActionEnv): ClientEnv => ({
          logger: clientLogger,
          serverUrl
        })
      )(f)
    )
  );

const liftProofGenerator = <Conf, T>(
  f: GenerateProof<Conf, T>,
  cfg: Conf
): Action<T> =>
  pipe(
    askSublogger('proofGenerator'),
    RTE.chain(
      (proofGeneratorLogger: Logger): Action<T> =>
        withRTE(
          (error: GenerateProofError): ActionError => ({
            __tag: 'proofGenerationError',
            error
          }),
          (): GenerateProofEnv<Conf> => ({
            logger: proofGeneratorLogger,
            config: cfg
          })
        )(f)
    )
  );

export const loginAction = <PGConf>(
  proofGenerator: IProofGenerator<PGConf>,
  pgConf: PGConf
): Action<{ token: string; refreshToken: string }> =>
  pipe(
    useLogger((logger) => logger.info('performing login')),
    tapLogger((logger) => logger.info('generating proof')),
    RTE.chain(() => liftProofGenerator(proofGenerator.generateProof(), pgConf)),
    tapLogger((logger) => logger.info('making logging request')),
    RTE.chain((proof) => liftClient(login(proof))),
    tapLogger((logger) => logger.info('login successfully'))
  );

export const refreshAction = (
  jwt: string,
  refreshToken: string
): Action<{ token: string }> =>
  pipe(
    useLogger((logger) => logger.info('performing refresh')),
    tapLogger((logger) => logger.info('making refresh request')),
    RTE.chain(() => liftClient(refresh(jwt, refreshToken))),
    tapLogger((logger) => logger.info('refresh successfully'))
  );

export const accessProtectedAction = (jwt: string): Action<void> =>
  pipe(
    useLogger((logger) => logger.info('accessing protected route')),
    tapLogger((logger) => logger.info('making request')),
    RTE.chain(() => liftClient(accessProtected(jwt))),
    tapLogger((logger, { message }) =>
      logger.info(`greeting message: ${message}`)
    ),
    RTE.asUnit
  );

export const fullWorkflowAction = <PGConf>(
  proofGenerator: IProofGenerator<PGConf>,
  pgConf: PGConf
): Action<void> =>
  pipe(
    useLogger((logger) => logger.info('running full workflow')),
    RTE.chain(() => loginAction(proofGenerator, pgConf)),
    RTE.tap(({ token }) => accessProtectedAction(token)),
    RTE.chain(({ token, refreshToken }) => refreshAction(token, refreshToken)),
    RTE.tap(({ token }) => accessProtectedAction(token)),
    tapLogger((logger) => logger.info('done running full workflow')),
    RTE.asUnit
  );
