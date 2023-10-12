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

interface VerifyProofData {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

const main = pipe(
  TE.Do,
  TE.bind('cfg', () => readConfigurationFallback),
  TE.let('pcProvider', () => new InMemoryProofCacheProvider()),
  TE.tap(() => TE.fromIO(() => console.info('initializing plugins'))),
  TE.bind('activePlugins', ({ cfg, pcProvider }) =>
    initializePlugins(cfg, pcProvider)
  ),
  TE.bind('app', () => TE.fromIO(express)),
  TE.tap(({ app, activePlugins, cfg, pcProvider }) =>
    pipe(
      TE.fromIO(() => {
        app.use(bodyParser.json());
        TE.fromIO(() => console.info('installing custom routes for plugins'));
      }),
      TE.chain(() => installCustomRoutes(activePlugins)(app)),
      TE.chain(() =>
        TE.fromIO(() => {
          app
            .post(
              '/verifyProof',
              (req: Request, res: Response): Promise<void> => {
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
            .listen(cfg.port, cfg.address, () =>
              console.log(
                `server is running on http://${cfg.address}:${cfg.port}`
              )
            );
        })
      )
    )
  ),
  TE.tapError((error) => (): Promise<Either<string, never>> => {
    console.error(`unhandled error: ${error}`);
    process.exit(1);
  })
);

main();
