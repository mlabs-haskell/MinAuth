import * as z from 'zod';
import MembershipsProver from './prover.js';
import { pipe } from 'fp-ts/lib/function.js';
import { Field } from 'o1js';
import * as A from 'fp-ts/lib/Array.js';
import * as E from 'fp-ts/lib/Either.js';
import {
  GenerateProof,
  GenerateProofError,
  ProofGenerator,
  askConfig
} from 'minauth/dist/plugin/proofgenerator.js';
import {
  Decoder,
  EncodeDecoder,
  wrapZodDec
} from 'minauth/dist/plugin/encodedecoder.js';
import {
  FpInterfaceType,
  fpInterfaceTag
} from 'minauth/dist/plugin/interfacekind.js';
import { Either } from 'fp-ts/lib/Either.js';
import { MinAuthProof } from 'minauth/dist/common/proof.js';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import { safeFromString } from 'minauth/dist/utils/fp/either.js';
import { tapLogger } from 'minauth/dist/utils/fp/readertaskeither.js';
import { fieldEncDec } from 'minauth/dist/utils/fp/fieldEncDec.js';

// TODO/FIXME: Copy-paste from src/plugins/merkleMemberships/server/index.ts, should move to utils.
const bigintEncDec: EncodeDecoder<FpInterfaceType, bigint> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      wrapZodDec('fp', z.string()).decode(i),
      E.chain(
        safeFromString(BigInt, (err) => `failed to decode bigint: ${err}`)
      )
    ),
  encode: (val: bigint): unknown => val.toString()
};

/** Prover input schema */
const rawPublicAndPrivateInputsSchema = z.object({
  treeRoot: z.string(),
  leafIndex: z.string(),
  secret: z.string()
});

type RawPublicAndPrivateInputs = z.infer<
  typeof rawPublicAndPrivateInputsSchema
>;

/** Config schema */
const rawConfSchema = z.object({
  pluginUrl: z.string(),
  allInputs: z.array(rawPublicAndPrivateInputsSchema)
});

/** The configuration for the Merkle memberships proof generator */
export type Conf = {
  pluginUrl: string; // url of the plugin @ the server
  allInputs: Array<{
    // for each membership set
    treeRoot: Field;
    leafIndex: bigint; // secret
    secret: Field; // secret
  }>;
};

const confDec: Decoder<FpInterfaceType, Conf> = {
  __interface_tag: fpInterfaceTag,
  decode: (inp: unknown): Either<string, Conf> =>
    pipe(
      E.Do,
      E.bind('confRaw', () =>
        wrapZodDec(fpInterfaceTag, rawConfSchema).decode(inp)
      ),
      E.bind('typedAllInputs', ({ confRaw: { allInputs } }) =>
        A.traverse(E.Applicative)(
          ({ treeRoot, leafIndex, secret }: RawPublicAndPrivateInputs) =>
            pipe(
              E.Do,
              E.bind('treeRoot', () => fieldEncDec.decode(treeRoot)),
              E.bind('leafIndex', () => bigintEncDec.decode(leafIndex)),
              E.bind('secret', () => fieldEncDec.decode(secret))
            )
        )(allInputs)
      ),
      E.map(
        ({ confRaw: { pluginUrl }, typedAllInputs }): Conf => ({
          pluginUrl,
          allInputs: typedAllInputs
        })
      )
    )
};

const fromTE =
  (mapError: (_: string) => GenerateProofError) =>
  <T>(f: TaskEither<string, T>): GenerateProof<Conf, T> =>
    pipe(RTE.fromTaskEither(f), RTE.mapError(mapError));

/**
 * Generate a proof using the Merkle memberships prover.
 */
const generateProof = (): GenerateProof<Conf, MinAuthProof> =>
  pipe(
    RTE.Do,
    tapLogger((logger) =>
      logger.info('generating proof using merkle memberships prover')
    ),
    RTE.bind('config', askConfig<Conf>),
    RTE.bind('prover', ({ config: { pluginUrl } }) =>
      fromTE((err) => ({
        __tag: 'failedToInitializeProver',
        reason: err
      }))(MembershipsProver.initialize({ baseUrl: pluginUrl }))
    ),
    tapLogger((logger) => logger.info('prover initialized')),
    RTE.let('publicInputArgs', ({ config: { allInputs } }) =>
      A.map(
        ({ treeRoot, leafIndex }: { treeRoot: Field; leafIndex: bigint }) => ({
          treeRoot,
          leafIndex
        })
      )(allInputs)
    ),
    RTE.bind('publicInputs', ({ prover, publicInputArgs }) =>
      fromTE((err) => ({
        __tag: 'failedToFetchPublicInputs',
        reason: err,
        publicInputArgs
      }))(prover.fetchPublicInputs(publicInputArgs))
    ),
    tapLogger((logger, { publicInputs }) =>
      logger.debug('public inputs', publicInputs)
    ),
    RTE.let('secretInputs', ({ config: { allInputs } }) =>
      A.map(({ secret }: { secret: Field }) => secret)(allInputs)
    ),
    tapLogger((logger) => logger.info('proving')),
    // build the proof
    RTE.bind('proof', ({ publicInputs, secretInputs, prover }) =>
      fromTE((err) => ({ __tag: 'failedToProve', reason: err }))(
        prover.prove(publicInputs, secretInputs)
      )
    ),
    // NOTE: Public input arguments have a different meaning from the
    // server's point of view. In particular, the server must not know
    // which leaf was used.
    RTE.let('encodedPublicInputArgs', ({ publicInputArgs }) =>
      A.map(({ treeRoot }: { treeRoot: Field }) => treeRoot.toString())(
        publicInputArgs
      )
    ),
    // return the proof
    RTE.map(
      ({ encodedPublicInputArgs, proof }): MinAuthProof => ({
        plugin: 'MerkleMembershipsPlugin',
        input: { proof, merkleRoots: encodedPublicInputArgs }
      })
    ),
    tapLogger((logger) => logger.info('all done'))
  );

/**
 * Export the generator
 */
export const generator: ProofGenerator<Conf> = {
  confDec,
  generateProof
};

export default generator;
