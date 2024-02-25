import * as expressCore from 'express-serve-static-core';
import { PMap, IPluginHost } from './ipluginhost.js';
import {
  IMinAuthPlugin,
  OutputValidity,
  tsToFpMinAuthPlugin
} from '../plugin/plugintype';
import { FpInterfaceType, TsInterfaceType } from '../plugin/interfacekind';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import * as TE from 'fp-ts/lib/TaskEither';
import * as Arr from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/function.js';
import { Either } from 'fp-ts/lib/Either.js';
import * as E from 'fp-ts/lib/Either.js';
import { Logger } from '../plugin/logger.js';
import { sequenceS } from 'fp-ts/lib/Apply.js';
import { InterfaceKind } from '../plugin/interfacekind';
import { fromFailableIO } from '../utils/fp/taskeither.js';

export class InMemoryPluginHost implements IPluginHost<FpInterfaceType> {
  __interface_tag: FpInterfaceType = 'fp';

  readonly plugins: PMap<IMinAuthPlugin<FpInterfaceType, unknown, unknown>>;

  constructor(
    plugins: IMinAuthPlugin<InterfaceKind, unknown, unknown>,
    protected readonly log: Logger
  ) {
    // convert all plugins to the correct interface
    this.plugins = Object.entries(plugins).reduce(
      (acc, [pluginName, plugin]) => {
        let p: IMinAuthPlugin<FpInterfaceType, unknown, unknown>;
        if (plugin.__interface_tag == 'ts') {
          p = tsToFpMinAuthPlugin(
            plugin as IMinAuthPlugin<TsInterfaceType, unknown, unknown>
          );
        } else {
          p = plugin as IMinAuthPlugin<FpInterfaceType, unknown, unknown>;
        }

        p satisfies IMinAuthPlugin<FpInterfaceType, unknown, unknown>;

        acc[pluginName] = p;
        return acc;
      },
      {} as PMap<IMinAuthPlugin<FpInterfaceType, unknown, unknown>>
    );
  }

  /**
   * Verify all proofs and get outputs
   * @param inputs - Mappping of plugin names to inputs
   * @returns Mapping of plugin names to generated outputs or error messages.
   *          If TaskEither is left, there was an exception during processing the verification requessss.
   *          If Either is left, the input to a plugin was invalid or plugin did not verify the input.
   */
  verifyProofAndGetOutput(
    inputs: PMap<unknown>
  ): TaskEither<string, PMap<Either<string, unknown>>> {
    // verify all proofs and get outputs
    const outputs: PMap<unknown> = {};

    const processPlugin = ([pluginName, input]: [string, unknown]): TaskEither<
      string,
      Either<string, unknown>
    > => {
      this.log.info(`Verifying proof for plugin "${pluginName}"`);
      try {
        const plugin = this.plugins[pluginName];
        if (!plugin) {
          return TE.left(`Plugin "${pluginName}" not found`);
        }

        const inputVerification: TaskEither<string, unknown> = pipe(
          TE.fromEither(plugin.inputDecoder.decode(input)),
          TE.chain((typedInput) => plugin.verifyAndGetOutput(typedInput)),
          TE.map((output) => plugin.outputEncDec.encode(output)),
          TE.map((encodedOutput) => {
            outputs[pluginName] = encodedOutput;
          })
        );

        const ret: TaskEither<string, Either<string, unknown>> = pipe(
          inputVerification,
          TE.fold(
            // For left, transform it into a right containing a left (E.left)
            (error) => TE.of(E.left(error)),
            // For right, transform it into a right containing a right (E.right)
            (result) => TE.of(E.right(result))
          )
        );

        return ret;
      } catch (e) {
        this.log.error(
          `Exception while verifying proof for plugin "${pluginName}: ${e}`
        );
        return TE.left(
          `Exception while processing plugin "${pluginName}": ${e}`
        );
      }
    };

    // Using sequenceS to process all tasks in parallel, while collecting their results
    const processPluginTasks = Object.entries(inputs).reduce(
      (acc, [pluginName, input]) => {
        acc[pluginName] = processPlugin([pluginName, input]); // Assuming processPlugin is correctly implemented
        return acc;
      },
      {} as Record<string, TaskEither<string, Either<string, unknown>>>
    );

    return sequenceS(TE.ApplicativePar)(processPluginTasks);
  }

  /**
   * Check the validity of the outputs
   * @param outputs - Mapping of plugin names to outputs
   * @returns Mapping of plugin names to output validity
   */
  checkOutputValidity(
    outputs: PMap<unknown>
  ): TaskEither<string, PMap<OutputValidity>> {
    const processPlugin = ([pluginName, output]: [string, unknown]): TaskEither<
      string,
      OutputValidity
    > => {
      this.log.info(`Checking output validity for plugin "${pluginName}"`);
      try {
        const plugin = this.plugins[pluginName];
        if (!plugin) {
          return TE.left(`Plugin "${pluginName}" not found`);
        }

        return pipe(
          TE.fromEither(plugin.outputEncDec.decode(output)),
          TE.chain((typedOutput) => plugin.checkOutputValidity(typedOutput))
        );
      } catch (e) {
        this.log.error(
          `Exception while checking output validity for plugin "${pluginName}: ${e}`
        );
        return TE.left(
          `Exception while checking output validity for plugin "${pluginName}": ${e}`
        );
      }
    };
    // check the outputs
    const processPluginTasks = Object.entries(outputs).reduce(
      (acc, [pluginName, input]) => {
        acc[pluginName] = processPlugin([pluginName, input]); // Assuming processPlugin is correctly implemented
        return acc;
      },
      {} as Record<string, TaskEither<string, OutputValidity>>
    );

    return sequenceS(TE.ApplicativePar)(processPluginTasks);
  }

  isReady() {
    return TE.right(true);
  }

  activePluginNames(): TaskEither<string, string[]> {
    return TE.right(Object.keys(this.plugins));
  }

  // this ties us into the express app
  installCustomRoutes(
    app: expressCore.Express,
    mkPluginRoute: (pluginName: string) => string = (pluginName) =>
      `/plugins/${pluginName}`
  ): TaskEither<string, void> {
    const processPlugin = (pluginName: string): TaskEither<string, void> => {
      const plugin = this.plugins[pluginName];
      if (!plugin) {
        return TE.left(`Plugin "${pluginName}" not found`);
      }

      return pipe(
        fromFailableIO(
          () =>
            app.use(
              mkPluginRoute(pluginName),
              (req, _, next) => {
                this.log.debug('handling plugin custom route', {
                  pluginName,
                  method: req.method,
                  path: req.path
                });
                next();
              },
              plugin.customRoutes
            ),
          `unable to install custom route at ${mkPluginRoute(
            pluginName
          )} for plugin "${pluginName}"`
        ),
        TE.map(() => undefined)
      );
    };

    return pipe(
      Object.keys(this.plugins),
      Arr.traverse(TE.ApplicativeSeq)(processPlugin),
      TE.map(() => undefined)
    );
  }
}
