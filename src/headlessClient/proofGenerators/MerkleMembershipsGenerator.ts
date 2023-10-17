import * as z from 'zod';
import MembershipsProver from '@plugins/merkleMemberships/client';
import { safeFromString } from '@utils/fp/TaskEither';
import { pipe } from 'fp-ts/function';
import { Field } from 'o1js';
import * as TE from 'fp-ts/TaskEither';
import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import { ProofGeneratorFactory } from '../ProofGenerator';

const publicAndPrivateInputsSchema = z.object({
  treeRoot: z.string(),
  leafIndex: z.string(),
  secret: z.string()
});

type PublicAndPrivateInputs = z.infer<typeof publicAndPrivateInputsSchema>;

const allInputsSchema = z.array(publicAndPrivateInputsSchema);

const confSchema = z.object({
  pluginUrl: z.string(),
  allInputs: allInputsSchema
});

export type Conf = z.infer<typeof confSchema>;

const Factory: ProofGeneratorFactory<Conf> = {
  confSchema: confSchema,
  mkGenerator: (cfg: Conf) => () =>
    pipe(
      TE.Do,
      TE.bind('prover', () =>
        MembershipsProver.initialize({
          baseUrl: cfg.pluginUrl
        })
      ),
      TE.bind('publicInputArgs', () =>
        A.traverse(TE.ApplicativePar)(
          ({ treeRoot, leafIndex }: PublicAndPrivateInputs) =>
            pipe(
              TE.Do,
              TE.bind('treeRoot', () => safeFromString(Field)(treeRoot)),
              TE.bind('leafIndex', () => safeFromString(BigInt)(leafIndex))
            )
        )(cfg.allInputs)
      ),
      TE.bind('secretInputs', () =>
        A.traverse(TE.ApplicativePar)(({ secret }: PublicAndPrivateInputs) =>
          safeFromString(Field)(secret)
        )(cfg.allInputs)
      ),
      TE.bind('publicInputs', ({ prover, publicInputArgs }) =>
        prover.fetchPublicInputs(publicInputArgs)
      ),
      TE.bind('proof', ({ prover, publicInputs, secretInputs }) =>
        prover.prove(publicInputs, secretInputs)
      )
    )().then(
      E.match(
        (err) => Promise.reject(err),
        ({ proof, publicInputArgs }) =>
          Promise.resolve({
            plugin: 'MerkleMembershipsPlugin',
            proof,
            // NOTE: Public input arguments have a different meaning from the
            // server's point of view. In particular, the server must not know
            // which leaf was used.
            publicInputArgs: publicInputArgs.map((args) =>
              args.treeRoot.toString()
            )
          })
      )
    )
};

export default Factory;
