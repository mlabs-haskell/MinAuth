import * as expressCore from 'express-serve-static-core';
import * as R from 'fp-ts/Record';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { pipe } from 'fp-ts/lib/function';
import { JsonProof, verify } from 'o1js';
import { OutputValidity } from './pluginType';
import { guard, tryCatch, tryCatchIO } from '@utils/fp/ReaderTaskEither';
import {
  PluginRuntime,
  RuntimePluginInstance,
  askActivePlugins,
  askLogger,
  askPluginInstance,
  tapAndLogError,
  useLogger
} from './pluginRuntime';

/**
 * Install custom routes for a plugin into the express app.
 * The routes are installed under `/plugins/${pluginName}`.
 * and come from `pluginInstance.customRoutes`.
 * The routes are meant for plugin / prover communication.
 */
const installPluginsCustomRoutes =
  (app: expressCore.Express) =>
  (
    pluginName: string,
    pluginInstance: RuntimePluginInstance
  ): PluginRuntime<void> =>
    pipe(
      askLogger(),
      RTE.chain((logger) =>
        tryCatchIO(
          () =>
            app.use(
              `/plugins/${pluginName}`,
              (req, _, next) => {
                logger.debug('handling plugin custom route', {
                  pluginName,
                  method: req.method,
                  path: req.path
                });
                next();
              },
              pluginInstance.customRoutes
            ),
          (reason) => `unable to install custom route: ${reason}`
        )
      ),
      RTE.asUnit
    );

/**
 * Install custom routes for all the active plugins.
 * The routes are installed under `/plugins/${pluginName}`.
 * and come from `pluginInstance.customRoutes`.
 * The routes are meant for plugin / prover communication.
 */
export const installCustomRoutes = (
  app: expressCore.Express
): PluginRuntime<void> =>
  pipe(
    askActivePlugins(),
    RTE.chain(
      R.traverseWithIndex(RTE.ApplicativeSeq)(installPluginsCustomRoutes(app))
    ),
    RTE.asUnit,
    tapAndLogError('failed to install custom routes')
  );

/**
 * Verify proof with given plugin and return its output.
 */
export const verifyProof = (
  proof: JsonProof,
  // The encoded public input arguments.
  publicInputArgs: unknown,
  pluginName: string
): PluginRuntime</* The encoded plugin output*/ unknown> =>
  pipe(
    RTE.Do,
    RTE.tap(() =>
      useLogger((logger) => {
        logger.info(`verifying proof using plugin ${pluginName}`);
        logger.debug({
          pluginName,
          proof,
          // NOTE: converting bigints to json may fail
          publicInputArgs: String(publicInputArgs)
        });
      })
    ),
    RTE.bind('pluginInstance', () => askPluginInstance(pluginName)),
    // TODO remove this step - this will be handled by the plugin
    // Step 1: check that the proof was generated using a certain verification key.
    RTE.tap(({ pluginInstance }) =>
      pipe(
        tryCatch(
          () => verify(proof, pluginInstance.verificationKey),
          (reason) => `unable to verify proof: ${reason}`
        ),
        RTE.chain(guard('invalid proof'))
      )
    ),
    // Step 2: use the plugin to extract the output. The plugin is also responsible
    // for checking the legitimacy of the public inputs.
    RTE.bind('typedPublicInputArgs', ({ pluginInstance }) =>
      RTE.fromEither(pluginInstance.publicInputArgsDec.decode(publicInputArgs))
    ),
    RTE.bind('output', ({ typedPublicInputArgs, pluginInstance }) =>
      RTE.fromTaskEither(
        pluginInstance.verifyAndGetOutput(typedPublicInputArgs, proof)
      )
    ),
    RTE.map(({ pluginInstance, output }) =>
      pluginInstance.outputEncDec.encode(output)
    ),
    tapAndLogError(`unable to verify proof using plugin ${pluginName}`)
  );

/** Validate the output of a plugin within the active  plugin runtime.
 */
export const validateOutput = (
  pluginName: string,
  // The encoded plugin output
  output: unknown
): PluginRuntime<OutputValidity> =>
  pipe(
    RTE.Do,
    RTE.tap(() =>
      useLogger((logger) => {
        logger.info(`validating output using plugin ${pluginName}`);
        logger.debug({ pluginName, output });
      })
    ),
    RTE.bind('pluginInstance', () => askPluginInstance(pluginName)),
    RTE.bind('typedOutput', ({ pluginInstance }) =>
      RTE.fromEither(pluginInstance.outputEncDec.decode(output))
    ),
    RTE.chain(({ typedOutput, pluginInstance }) =>
      RTE.fromTaskEither(pluginInstance.checkOutputValidity(typedOutput))
    ),
    tapAndLogError(`unable to validate proof using plugin ${pluginName}`)
  );

// TODO: utilities to run provers
