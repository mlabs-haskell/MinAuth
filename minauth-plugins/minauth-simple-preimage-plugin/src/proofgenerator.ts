import * as E from 'fp-ts/Either';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { pipe } from 'fp-ts/lib/function';
import { Field, Poseidon } from 'o1js';
import { z } from 'zod';

import {
  Decoder,
  EncodeDecoder,
  wrapZodDec
} from 'minauth/plugin/encodedecoder';
import { FpInterfaceType, fpInterfaceTag } from 'minauth/plugin/interfacekind';
import {
  GenerateProof,
  GenerateProofError,
  ProofGenerator,
  askConfig
} from 'minauth/plugin/proofgenerator';
import { MinAuthProof } from 'minauth/server/minauthstrategy';
import { safeFromString } from 'minauth/utils/fp/either';
import {
  askSublogger,
  tapLogger,
  tryCatch
} from 'minauth/utils/fp/readertaskeither';

import { SimplePreimageProver } from './prover';

const rawConfSchema = z.object({
  password: z.string()
});

// TODO give more visibility to proof generator configs
/** Configuration for proof generation.
 */
export type Conf = { password: Field };

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
      wrapZodDec('fp', rawConfSchema).decode(inp),
      E.chain(({ password }) => fieldEncDec.decode(password)),
      E.map((password) => ({ password }))
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
    RTE.bind('prover', ({ logger }) =>
      tryCatch(
        () => SimplePreimageProver.initialize(logger),
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
