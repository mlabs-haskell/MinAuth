import { SimplePreimageProver } from '@plugins/simplePreimage/client';
import { Field, Poseidon } from 'o1js';
import { z } from 'zod';
import { ProofGeneratorFactory } from '../ProofGenerator';

const confSchema = z.object({
  password: z.string()
});

export type Conf = z.infer<typeof confSchema>;

const Factory: ProofGeneratorFactory<Conf> = {
  confSchema: confSchema,
  mkGenerator: (cfg: Conf) => async () => {
    const privateInput = Field.from(cfg.password);
    const publicInput = Poseidon.hash([privateInput]);
    const prover = await SimplePreimageProver.initialize();
    const proof = await prover.prove(publicInput, privateInput);
    return {
      plugin: 'SimplePreimagePlugin',
      publicInputArgs: {},
      proof
    };
  }
};

export default Factory;
