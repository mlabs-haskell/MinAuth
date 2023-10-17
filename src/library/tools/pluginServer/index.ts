import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JsonProof } from 'o1js';
import { pipe } from 'fp-ts/lib/function';
import { initializePlugins } from '@lib/plugin/fp/pluginLoader';
import * as TE from 'fp-ts/TaskEither';
import * as T from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import { installCustomRoutes, verifyProof } from '@lib/plugin/fp/utils';
import { Either } from 'fp-ts/Either';
import { readConfigurationFallback } from './config';
import { InMemoryProofCacheProvider } from '@lib/plugin';
import { fromFailableIO } from '@utils/fp/TaskEither';

/**
 * This function starts a provisional plugin server meant mostly for development purposes,
 * so that developing your backend services doesn't require restarting plugins and their services.
 * It reads configuration from a file and initializes a set of plugins.
 * You can interact with the plugins via HTTP API consisting of:
 * - '/verifyProof' endpoint to validate proofs and get a plugin's output
 * - TODO '/checkOutputValidity' endpoint to verify if output is still valid
 *
 * NOTE:
 * The code uses fp-ts library and monadic approach to build effectful computations.
 * The use of library itself should not require to adopt this approach.
 */
const main = pipe(
  TE.Do,
  // read configuration
  TE.bind('cfg', () => readConfigurationFallback),
  // initialize proof cache provider
  TE.let('pcProvider', () => new InMemoryProofCacheProvider()),
  // initialize plugins
  TE.tap(() => TE.fromIO(() => console.info('initializing plugins'))),
  TE.bind('activePlugins', ({ cfg, pcProvider }) =>
    initializePlugins(cfg, pcProvider)
  ),
  // initialize express.js app
  TE.bind('app', () => TE.fromIO(express)),
  TE.tap(({ app, activePlugins, cfg, pcProvider }) =>
    pipe(
      // configure the express.js app
      TE.fromIO(() => {
        app.use(bodyParser.json());
        TE.fromIO(() => console.info('installing custom routes for plugins'));
      }),
      // install custom routes of activated  plugins
      TE.chain(() => installCustomRoutes(activePlugins)(app)),
      TE.chain(() =>
        TE.fromIO(() => {
          app
            // setup endpoints
            .post(
              '/verifyProof',
              (req: Request, res: Response): Promise<void> => {
                // TODO use zod schema and safely parse.
                const body = req.body as VerifyProofData;
                return pipe(
                  verifyProof(activePlugins, pcProvider)(
                    body.proof,
                    body.publicInputArgs,
                    body.plugin
                  ),
                  T.chain(
                    E.match(
                      (error: string) =>
                        T.fromIO(() => res.status(400).json({ error })),
                      (r) => T.fromIO(() => res.status(200).json(r))
                    )
                  ),
                  T.map(() => {})
                )();
              }
            )
            // handle errors
            .all('*', (_, resp) =>
              resp.status(404).json({ error: 'bad route' })
            )
            .use((err: unknown, _req: Request, resp: Response) => {
              console.error(`unhandled express error: ${err}`);
              resp.status(500).json({ error: 'internal server error' });
            });
        })
      ),
      TE.chain(() =>
        fromFailableIO(() =>
          app.listen(cfg.port, cfg.address, () =>
            console.log(
              `server is running on http://${cfg.address}:${cfg.port}`
            )
          )
        )
      )
    )
  ),
  TE.tapError((error) => (): Promise<Either<string, never>> => {
    console.error(`unhandled error: ${error}`);
    process.exit(1);
  })
);

/**
 * The input to /verifyProof
 *  TODO switch to zod schema.
 */
interface VerifyProofData {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

// start the server
main();
