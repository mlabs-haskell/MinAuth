import { TaskEither } from 'fp-ts/lib/TaskEither';
import {
  ActivePlugins,
  UntypedPlugin,
  ProofCacheProvider
} from './pluginLoader';
import * as expressCore from 'express-serve-static-core';
import { fromFailableIO, liftZodParseResult } from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import { JsonProof } from 'o1js';
import { ProofKey, tsToFpProofCacheProvider } from './proofCache';

/**
 *  Curried function. Given a set of plugins, and an express.js app
 *  install custom routes for each plugin.
 */
export const installCustomRoutes =
  (activePlugins: ActivePlugins) =>
  (app: expressCore.Express): TaskEither<string, void> =>
    pipe(
      R.traverseWithIndex(TE.ApplicativeSeq)(
        (pluginName, pluginInstance: UntypedPlugin) =>
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

/**
 * Curried function. Given set of plugins, plugin identifier and plugin proof
 * verification inputs - verify proof, and store and return the plugin output.
 */
export const verifyProof =
  (activePlugins: ActivePlugins, proofCacheProvider: ProofCacheProvider) =>
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
      // lookup an active plugin by name
      TE.bind('pluginInstance', () =>
        TE.fromOption(() => `plugin ${pluginName} not found`)(
          R.lookup(pluginName)(activePlugins)
        )
      ),
      // Parse public input arguments.
      TE.bind('typedPublicInputArgs', ({ pluginInstance }) =>
        liftZodParseResult(
          pluginInstance.publicInputArgsSchema.safeParse(publicInputArgs)
        )
      ),
      // Use the plugin to verify the proof and prepare the output
      // The plugin is also responsible for checking the legitimacy
      // of the public inputs.
      TE.bind('output', ({ typedPublicInputArgs, pluginInstance }) =>
        pluginInstance.verifyAndGetOutput(typedPublicInputArgs, proof)
      ),

      // Store the output in the cache and get its cache key.
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
      // Return the output and the cache key.
      // (`TE.map` in pipe lifts the function to `TaskEither` monad)
      TE.map(({ proofKey, output }) => {
        return {
          proofKey,
          output
        };
      })
    );

// TODO: utilities to run provers
