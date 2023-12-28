import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither.js';

import { Decoder } from './encodedecoder.js';
import { FpInterfaceType } from './interfacekind.js';
import { Logger } from './logger.js';
import { MinAuthProof } from '../common/proof.js';
import { askRecordField } from '../utils/fp/readertaskeither.js';

export type GenerateProofEnv<Conf> = Readonly<{
  logger: Logger;
  config: Conf;
}>;

export type GenerateProofError =
  | {
      __tag: 'failedToInitializeProver';
      reason: string;
    }
  | {
      __tag: 'failedToProve';
      reason: string;
    }
  | {
      __tag: 'failedToFetchPublicInputs';
      reason: string;
      publicInputArgs: unknown;
    }
  | {
      __tag: 'otherError';
      detail: unknown;
    };

export type GenerateProof<Conf, A> = ReaderTaskEither<
  GenerateProofEnv<Conf>,
  GenerateProofError,
  A
>;

export interface ProofGenerator<Conf> {
  generateProof: () => GenerateProof<Conf, MinAuthProof>;

  readonly confDec: Decoder<FpInterfaceType, Conf>;
}

export type UntypedProofGenerator = ProofGenerator<unknown>;

export const askConfig = <Conf>(): GenerateProof<Conf, Conf> =>
  askRecordField('config');

export const asUntypedProofGenerator = <Conf>({
  confDec,
  generateProof
}: ProofGenerator<Conf>): UntypedProofGenerator => ({
  confDec,
  generateProof: () => (c: GenerateProofEnv<unknown>) =>
    generateProof()(c as GenerateProofEnv<Conf>)
});
