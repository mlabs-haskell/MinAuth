import * as expressCore from 'express-serve-static-core';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import * as E from 'fp-ts/lib/Either.js';
import { Either } from 'fp-ts/lib/Either.js';
import {
  FpInterfaceType,
  OutputValidity,
  outputInvalid,
  outputValid
} from '../plugin-promise-api.js';
import { IPluginHost, PMap } from '../pluginhost.js';
import { pipe } from 'fp-ts/lib/function.js';
import { sequenceS } from 'fp-ts/lib/Apply.js';
import { Logger } from '../../plugin/logger.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ErrorResponse, mkRequestTE } from '../../common/request.js';
import z from 'zod';

// export type PMap<T> = { [plugin: string]: T };
type PluginServerProxyHostConfig = {
  serverUrl: string;
  log: Logger;
};

export default class PluginServerProxyHost
  implements IPluginHost<FpInterfaceType>
{
  readonly __interface_tag: FpInterfaceType = 'fp';

  readonly log: Logger;
  readonly serverUrl: string;

  constructor(config: PluginServerProxyHostConfig) {
    this.log = config.log;
    this.serverUrl = config.serverUrl;
  }

  verifyProofAndGetOutput(
    inputs: PMap<unknown>
  ): TaskEither<string, PMap<Either<string, unknown>>> {
    const proxyPluginRequest = (
      plugin: string,
      input: unknown
    ): TaskEither<string, Either<string, unknown>> => {
      return pipe(
        mkRequestTE('/verifyProof', z.unknown(), { body: { plugin, input } }),
        TE.fold(
          // For left (general HTTP error), transform it into a right containing a left (E.left)
          (error) => TE.of(E.left(error.message)),
          // For right (successful plugin response), keep it as a right containing a right (E.right)
          (ok) => TE.of(E.right(ok.data))
        )
      );
    };

    // Process all the plugin requests in parallel
    const processPluginTasks = Object.entries(inputs).reduce(
      (acc, [pluginName, input]) => {
        this.log.info(
          `Forwarding verifyProofAndGetOutput as a http request to ${this.serverUrl}/verifyProof for ${pluginName}`
        );
        acc[pluginName] = proxyPluginRequest(pluginName, input); // Assuming processPlugin is correctly implemented
        return acc;
      },
      {} as Record<string, TaskEither<string, Either<string, unknown>>>
    );

    return sequenceS(TE.ApplicativeSeq)(processPluginTasks);
  }

  /**
   * Check the validity of the outputs
   * @param outputs - Mapping of plugin names to outputs
   * @returns Mapping of plugin names to output validity
   */
  checkOutputValidity(
    outputs: PMap<unknown>
  ): TaskEither<string, PMap<OutputValidity>> {
    const proxyPluginRequest = ([pluginName, output]: [
      string,
      unknown
    ]): TaskEither<string, OutputValidity> => {
      return pipe(
        mkRequestTE('/validateOutput', z.unknown(), {
          body: { pluginName, output }
        }),
        TE.fold(
          (error) => TE.of(outputInvalid(error.message)),
          (_) => TE.of(outputValid)
        )
      );
    };
    // check the outputs
    const processPluginTasks = Object.entries(outputs).reduce(
      (acc, [pluginName, input]) => {
        acc[pluginName] = proxyPluginRequest([pluginName, input]); // Assuming processPlugin is correctly implemented
        return acc;
      },
      {} as Record<string, TaskEither<string, OutputValidity>>
    );

    return sequenceS(TE.ApplicativeSeq)(processPluginTasks);
  }

  isReady(): TaskEither<string, boolean> {
    return pipe(
      mkRequestTE('/isReady', z.unknown()),
      TE.fold(
        (error) => TE.of(false),
        (success) => TE.of(true)
      )
    );
  }

  activePluginNames(): TaskEither<string, string[]> {
    return pipe(
      mkRequestTE('/plugins/activePlugins', z.array(z.string())),
      TE.map((response) => response.data),
      TE.mapLeft((e: ErrorResponse) => e.message)
    );
  }

  installCustomRoutes = (
    app: expressCore.Express
  ): TaskEither<string, void> => {
    return TE.tryCatch(
      () => {
        app.use('/plugins/:pluginName/*', (req, res, next) => {
          // Setup the proxy middleware dynamically based on the pluginName
          const proxy = createProxyMiddleware({
            target: `${this.serverUrl}`, // Target the base URL of the plugin server
            changeOrigin: true, // For vhosted sites, changes host header to match the target's host
            logLevel: 'debug' // Optional: adjust log level as needed
          });

          // Use the proxy middleware for this request
          proxy(req, res, next);
        });

        return Promise.resolve(); // Resolve the promise as void
      },
      (error) => `Failed to install custom routes: ${error}` // Error handling
    );
  };
}
