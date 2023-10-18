import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JsonProof } from 'o1js';
import { pipe } from 'fp-ts/lib/function';
import { initializePlugins } from '@lib/plugin/fp/pluginLoader';
import * as TE from 'fp-ts/TaskEither';
import {
  installCustomRoutes,
  validateOutput,
  verifyProof
} from '@lib/plugin/fp/utils';
import { Either } from 'fp-ts/Either';
import { readConfigurationFallback } from './config';
import {
  fromFailableIO,
  liftZodParseResult,
  wrapTrivialExpressHandler
} from '@utils/fp/TaskEither';
import { z } from 'zod';

interface VerifyProofData {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

const validateOutputDataSchema = z.object({
  plugin: z.string(),
  output: z.unknown()
});

type ValidateOutputData = z.infer<typeof validateOutputDataSchema>;

const main = pipe(
  TE.Do,
  TE.bind('cfg', () => readConfigurationFallback),
  TE.tap(() => TE.fromIO(() => console.info('initializing plugins'))),
  TE.bind('activePlugins', ({ cfg }) => initializePlugins(cfg)),
  TE.bind('app', () => TE.fromIO(express)),
  TE.tap(({ app, activePlugins, cfg }) =>
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
              wrapTrivialExpressHandler((req) => {
                const body = req.body as VerifyProofData;
                return pipe(
                  verifyProof(activePlugins)(
                    body.proof,
                    body.publicInputArgs,
                    body.plugin
                  ),
                  TE.map((output) => {
                    return { output };
                  })
                );
              })
            )
            .post(
              '/validateOutput',
              wrapTrivialExpressHandler((req) =>
                pipe(
                  liftZodParseResult(
                    validateOutputDataSchema.safeParse(req.body)
                  ),
                  TE.chain((body: ValidateOutputData) =>
                    validateOutput(activePlugins)(body.plugin, body.output)
                  )
                )
              )
            )
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

main();
