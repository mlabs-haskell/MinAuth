import { FpInterfaceType, Logger } from '@lib/plugin';
import { Decoder } from '@lib/plugin/fp/EncodeDecoder';
import { MinAuthProof } from '@lib/server/minauthStrategy';
import { askRecordField } from '@utils/fp/ReaderTaskEither';
import { ReaderTaskEither } from 'fp-ts/lib/ReaderTaskEither';

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

export interface IProofGenerator<Conf> {
  generateProof: () => GenerateProof<Conf, MinAuthProof>;

  readonly confDec: Decoder<FpInterfaceType, Conf>;
}

export type UntypedProofGenerator = IProofGenerator<unknown>;

export const askConfig = <Conf>(): GenerateProof<Conf, Conf> =>
  askRecordField('config');

export const asUntypedProofGenerator = <Conf>({
  confDec,
  generateProof
}: IProofGenerator<Conf>): UntypedProofGenerator => ({
  confDec,
  generateProof: () => (c: GenerateProofEnv<unknown>) =>
    generateProof()(c as GenerateProofEnv<Conf>)
});
