import { MinAuthProof } from '@lib/server/minauthStrategy';
import { z } from 'zod';

export interface ProofGeneratorFactory<Conf> {
  mkGenerator(conf: Conf): () => Promise<MinAuthProof>;

  readonly confSchema: z.Schema<Conf>;
}

export type UntypedProofGeneratorFactory = ProofGeneratorFactory<unknown>;
