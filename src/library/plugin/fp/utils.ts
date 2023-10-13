import { TaskEither } from 'fp-ts/lib/TaskEither';
import {
  ActivePlugins,
  UntypedPluginInstance,
  UntypedProofCacheProvider
} from './pluginLoader';
import * as expressCore from 'express-serve-static-core';
import {
  fromFailableIO,
  fromFailablePromise,
  liftZodParseResult
} from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import { JsonProof, verify } from 'o1js';
import { ProofKey, tsToFpProofCacheProvider } from './proofCache';

export const installCustomRoutes =
  (activePlugins: ActivePlugins) =>
  (app: expressCore.Express): TaskEither<string, void> =>
    pipe(
      R.traverseWithIndex(TE.ApplicativeSeq)(
        (pluginName, pluginInstance: UntypedPluginInstance) =>
          fromFailableIO(
            () =>
              app.use(
                `/plugins/${pluginName}`,
                (req, _, next) => {
                  console.debug(`${pluginName}: ${req.method} ${req.path}`);
                  next();
                },
                pluginInstance.customRoutes
              ),
            'failed to install custom route'
          )
      )(activePlugins),
      TE.asUnit
    );

export const verifyProof =
  (
    activePlugins: ActivePlugins,
    proofCacheProvider: UntypedProofCacheProvider
  ) =>
  (
    proof: JsonProof,
    publicInputArgs: unknown,
    pluginName: string
  ): TaskEither<string, { output: unknown; proofKey: ProofKey }> =>
    pipe(
      TE.Do,
      TE.tap(() =>
        TE.fromIO(() =>
          console.info(`verifying proof using plugin ${pluginName}`)
        )
      ),
      TE.bind('pluginInstance', () =>
        TE.fromOption(() => `plugin ${pluginName} not found`)(
          R.lookup(pluginName)(activePlugins)
        )
      ),
      // Step 1: check that the proof was generated using a certain verification key.
      TE.tap(({ pluginInstance }) =>
        pipe(
          fromFailablePromise(
            () => verify(proof, pluginInstance.verificationKey),
            'unable to verify proof'
          ),
          TE.tap((valid) =>
            valid ? TE.right(undefined) : TE.left('invalid proof')
          )
        )
      ),
      // Step 2: use the plugin to extract the output. The plugin is also responsible
      // for checking the legitimacy of the public inputs.
      TE.bind('typedPublicInputArgs', ({ pluginInstance }) =>
        liftZodParseResult(
          pluginInstance.publicInputArgsSchema.safeParse(publicInputArgs)
        )
      ),
      TE.bind('output', ({ typedPublicInputArgs, pluginInstance }) =>
        pluginInstance.verifyAndGetOutput(typedPublicInputArgs, proof)
      ),
      TE.bind('proofKey', () =>
        pipe(
          proofCacheProvider.__interface_tag == 'fp'
            ? proofCacheProvider
            : tsToFpProofCacheProvider(proofCacheProvider),
          (pcp) => pcp.getCacheOf(pluginName),
          TE.chain((cache) =>
            cache.storeProof({
              publicInputArgs,
              proof
            })
          )
        )
      ),
      TE.map(({ proofKey, output }) => {
        return {
          proofKey,
          output
        };
      })
    );

// TODO: utilities to run provers
