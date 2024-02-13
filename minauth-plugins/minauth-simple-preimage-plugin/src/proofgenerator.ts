import * as E from 'fp-ts/lib/Either.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import { Field, Poseidon } from 'o1js';
import { z } from 'zod';

import { fieldEncDec } from 'minauth/dist/utils/fp/fieldEncDec.js';
import { Decoder, wrapZodDec } from 'minauth/dist/plugin/encodedecoder.js';
import {
  FpInterfaceType,
  fpInterfaceTag
} from 'minauth/dist/plugin/interfacekind.js';
import {
  GenerateProof,
  GenerateProofError,
  ProofGenerator,
  askConfig
} from 'minauth/dist/plugin/proofgenerator.js';
import { MinAuthProof } from 'minauth/dist/common/proof.js';
import {
  askSublogger,
  tapLogger,
  tryCatch
} from 'minauth/dist/utils/fp/readertaskeither.js';

import { SimplePreimageProver } from './prover.js';
import { PluginRouter } from 'minauth/dist/plugin/pluginrouter.js';

// TODO give more visibility to proof generator configs

/** Schema validating serialized configuration.
 */

const InputConfSchema = z.object({
  pluginName: z.string().min(1),
  password: z.string(),
  serverUrl: z.string()
});

/** Configuration for proof generation.
 */
export type Conf = { pluginName: string; password: Field; serverUrl: string };

const confDec: Decoder<FpInterfaceType, Conf> = {
  __interface_tag: fpInterfaceTag,

  decode: (inp: unknown) =>
    pipe(
      E.Do,
      E.bind('rawSchema', () => wrapZodDec('fp', InputConfSchema).decode(inp)),
      E.bind('password', ({ rawSchema }) =>
        fieldEncDec.decode(rawSchema.password)
      ),
      E.map(({ password, rawSchema }) => ({
        password,
        serverUrl: rawSchema.serverUrl,
        pluginName: rawSchema.pluginName
      }))
    )
};

const generateProof = (): GenerateProof<Conf, MinAuthProof> =>
  pipe(
    RTE.Do,
    tapLogger((logger) =>
      logger.info('generating proof using simple password prover')
    ),
    RTE.bind('config', askConfig<Conf>),
    RTE.let('privateInput', ({ config: { password } }) => password),
    RTE.let('publicInput', ({ privateInput }) => Poseidon.hash([privateInput])),
    tapLogger((logger, { publicInput }) =>
      logger.debug('publicInput', publicInput)
    ),
    RTE.bind('logger', () => askSublogger('SimplePreimageProver')),
    RTE.bind('pluginRouterLogger', () => askSublogger('PluginRouterLogger')),
    RTE.bind('pluginRouter', ({ pluginRouterLogger, config }) =>
      tryCatch(
        () =>
          PluginRouter.initialize(
            pluginRouterLogger,
            config.serverUrl,
            config.pluginName
          ),
        (err): GenerateProofError => ({
          __tag: 'failedToInitializeProver',
          reason: `Error initializing plugin router: ${err}`
        })
      )
    ),
    RTE.let('simplePreimageConfig', ({ pluginRouter, logger }) => ({
      logger: logger,
      pluginRoutes: pluginRouter
    })),
    RTE.bind('prover', ({ simplePreimageConfig }) =>
      tryCatch(
        () => SimplePreimageProver.initialize(simplePreimageConfig),
        (err): GenerateProofError => ({
          __tag: 'failedToInitializeProver',
          reason: String(err)
        })
      )
    ),
    RTE.bind('proof', ({ prover, publicInput, privateInput }) =>
      tryCatch(
        () => prover.prove(publicInput, privateInput),
        (err): GenerateProofError => ({
          __tag: 'failedToProve',
          reason: String(err)
        })
      )
    ),
    tapLogger((logger) => logger.info('proof generated')),
    RTE.map(({ proof, config }) => ({
      plugin: config.pluginName,
      input: { proof }
    }))
  );

export const generator: ProofGenerator<Conf> = {
  confDec,
  generateProof
};

export default generator;
