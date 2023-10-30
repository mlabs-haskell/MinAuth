import { Field, Poseidon } from 'o1js';
import { z } from 'zod';
import {
  GenerateProof,
  GenerateProofError,
  IProofGenerator,
  askConfig
} from '../ProofGenerator';
import {
  Decoder,
  EncodeDecoder,
  wrapZodDec
} from '@lib/plugin/fp/EncodeDecoder';
import { FpInterfaceType, fpInterfaceTag } from '@lib/plugin';
import { pipe } from 'fp-ts/lib/function';
import { safeFromString } from '@utils/fp/Either';
import * as E from 'fp-ts/Either';
import { MinAuthProof } from '@lib/server/minauthStrategy';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { tapLogger, tryCatch } from '@utils/fp/ReaderTaskEither';
import { SimplePreimageProver } from '@plugins/simplePreimage/client';

const rawConfSchema = z.object({
  password: z.string()
});

export type Conf = { password: Field };

// FIXME: Copy-paste from src/plugins/merkleMemberships/server/index.ts, should move to utils.
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
    RTE.bind('prover', () =>
      tryCatch(
        () => SimplePreimageProver.initialize(),
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
      plugin: 'SimplePreimagePlugin',
      publicInputArgs: {},
      proof
    }))
  );

export const generator: IProofGenerator<Conf> = {
  confDec,
  generateProof
};

export default generator;
