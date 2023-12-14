import * as E from 'fp-ts/lib/Either.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import { Field, Poseidon } from 'o1js';
import { z } from 'zod';

import {
  Decoder,
  EncodeDecoder,
  wrapZodDec
} from 'minauth/plugin/encodedecoder.js';
import {
  FpInterfaceType,
  fpInterfaceTag
} from 'minauth/plugin/interfacekind.js';
import {
  GenerateProof,
  GenerateProofError,
  ProofGenerator,
  askConfig
} from 'minauth/plugin/proofgenerator.js';
import { MinAuthProof } from 'minauth/server/minauthstrategy.js';
import { safeFromString } from 'minauth/utils/fp/either.js';
import {
  askSublogger,
  tapLogger,
  tryCatch
} from 'minauth/utils/fp/readertaskeither.js';

import { PluginRouter, SimplePreimageProver } from './prover.js';

const rawConfSchema = z.object({
  password: z.string(),
  serverUrl: z.string()
});

// TODO give more visibility to proof generator configs
/** Configuration for proof generation.
 */
export type Conf = { password: Field; serverUrl: string };

// FIXME: Copy-paste from src/plugins/merkleMemberships/server/index.ts, should move to utils.
// TODO move to minauth-mina-utils (which is not yet created)
const fieldEncDec: EncodeDecoder<FpInterfaceType, Field> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      wrapZodDec('fp', z.string()).decode(i),
      E.chain(
        safeFromString(Field.from, (err) => `failed to decode Field: ${err}`)
      )
    ),

  encode: (i: Field) => i.toString()
};

const confDec: Decoder<FpInterfaceType, Conf> = {
  __interface_tag: fpInterfaceTag,

  decode: (inp: unknown) =>
    pipe(
      E.Do,
      E.bind('rawSchema', () => wrapZodDec('fp', rawConfSchema).decode(inp)),
      E.bind('password', ({ rawSchema }) =>
        fieldEncDec.decode(rawSchema.password)
      ),
      E.map(({ password, rawSchema }) => ({
        password,
        serverUrl: rawSchema.serverUrl
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
    RTE.let(
      'simplePreimageConfig',
      ({ pluginRouterLogger, config, logger }) => ({
        logger: logger,
        pluginRoutes: new PluginRouter(config.serverUrl, pluginRouterLogger)
      })
    ),
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
    RTE.map(({ proof }) => ({
      plugin: 'simple-preimage',
      publicInputArgs: {},
      proof
    }))
  );

export const generator: ProofGenerator<Conf> = {
  confDec,
  generateProof
};

export default generator;
