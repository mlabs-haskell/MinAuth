import { TaskEither } from 'fp-ts/lib/TaskEither';
import { ActivePlugins, RuntimePluginInstance } from './pluginLoader';
import * as expressCore from 'express-serve-static-core';
import { fromFailableIO, fromFailablePromise } from '@utils/fp/TaskEither';
import * as R from 'fp-ts/Record';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import { JsonProof, verify } from 'o1js';
import { OutputValidity } from './pluginType';

export const installCustomRoutes =
  (activePlugins: ActivePlugins) =>
  (app: expressCore.Express): TaskEither<string, void> =>
    pipe(
      R.traverseWithIndex(TE.ApplicativeSeq)(
        (pluginName, pluginInstance: RuntimePluginInstance) =>
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
  (activePlugins: ActivePlugins) =>
  (
    proof: JsonProof,
    // The encoded public input arguments.
    publicInputArgs: unknown,
    pluginName: string
  ): TaskEither<
    string,
    // The encoded plugin output
    unknown
  > =>
    pipe(
      TE.Do,
      TE.tapIO(
        () => () => console.info(`verifying proof using plugin ${pluginName}`)
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
        TE.fromEither(pluginInstance.publicInputArgsDec.decode(publicInputArgs))
      ),
      TE.bind('output', ({ typedPublicInputArgs, pluginInstance }) =>
        pluginInstance.verifyAndGetOutput(typedPublicInputArgs, proof)
      ),
      TE.map(({ pluginInstance, output }) =>
        pluginInstance.outputEncDec.encode(output)
      )
    );

export const validateOutput =
  (activePlugins: ActivePlugins) =>
  (
    pluginName: string,
    // The encoded plugin output
    output: unknown
  ): TaskEither<string, OutputValidity> =>
    pipe(
      TE.Do,
      TE.tapIO(
        () => () => console.info(`validating output using plugin ${pluginName}`)
      ),
      TE.bind('pluginInstance', () =>
        TE.fromOption(() => `plugin ${pluginName} not found`)(
          R.lookup(pluginName)(activePlugins)
        )
      ),
      TE.bind('typedOutput', ({ pluginInstance }) =>
        TE.fromEither(pluginInstance.outputEncDec.decode(output))
      ),
      TE.chain(({ typedOutput, pluginInstance }) =>
        pluginInstance.checkOutputValidity(typedOutput)
      )
    );

// TODO: utilities to run provers
