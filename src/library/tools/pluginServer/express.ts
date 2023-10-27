import { PluginRuntimeEnv } from '@lib/plugin/fp/pluginRuntime';
import {
  installCustomRoutes,
  validateOutput,
  verifyProof
} from '@lib/plugin/fp/utils';
import {
  launchTE,
  liftZodParseResult,
  wrapTrivialExpressHandler
} from '@utils/fp/TaskEither';
import bodyParser from 'body-parser';
import * as expressCore from 'express-serve-static-core';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { JsonProof } from 'o1js';
import { z } from 'zod';
import {
  PluginServer,
  askConfig,
  askPluginRuntimeEnv,
  askRootLogger,
  liftPluginRuntime,
  useExpressApp,
  useRootLogger,
  withExpressApp
} from './types';
import * as RTE from 'fp-ts/ReaderTaskEither';
interface VerifyProofData {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

const handleVerifyProof = (env: PluginRuntimeEnv) =>
  wrapTrivialExpressHandler((req) => {
    const body = req.body as VerifyProofData;
    return pipe(
      verifyProof(body.proof, body.publicInputArgs, body.plugin)(env),
      TE.map((output) => {
        return { output };
      })
    );
  });

const validateOutputDataSchema = z.object({
  plugin: z.string(),
  output: z.unknown()
});

type ValidateOutputData = z.infer<typeof validateOutputDataSchema>;

const handleValidateOutput =
  (env: PluginRuntimeEnv) =>
  async (req: expressCore.Request, resp: expressCore.Response): Promise<void> =>
    launchTE(
      pipe(
        liftZodParseResult(validateOutputDataSchema.safeParse(req.body)),
        TE.chain((body: ValidateOutputData) =>
          validateOutput(body.plugin, body.output)(env)
        ),
        TE.tapIO(
          (val) => () =>
            val.isValid
              ? resp.status(200).json({})
              : resp.status(400).json({ message: val.reason })
        ),
        TE.asUnit
      )
    );

const installBasicRoutes = (): PluginServer<void> =>
  pipe(
    askPluginRuntimeEnv(),
    RTE.chain((env) =>
      useExpressApp((app) =>
        app
          .use(bodyParser.json())
          .post('/verifyProof', handleVerifyProof(env))
          .post('/validateOutput', handleValidateOutput(env))
          .get('/health', (_, resp) => resp.status(200).json({}))
      )
    )
  );

const installFallbackHandlers = (): PluginServer<void> =>
  pipe(
    askRootLogger(),
    RTE.chain((logger) =>
      useExpressApp((app) =>
        app
          .all('*', (_, resp) => resp.status(404).json({ error: 'bad route' }))
          .use(
            (
              err: unknown,
              _req: expressCore.Request,
              resp: expressCore.Response
            ) => {
              logger.error('encountered unhandled express error', err);
              resp.status(500).json({ error: 'internal server error' });
            }
          )
      )
    )
  );

const installPluginCustomRoutes = (): PluginServer<void> =>
  pipe(
    useRootLogger((logger) =>
      logger.info('installing custom routes for plugins')
    ),
    RTE.chain(() =>
      withExpressApp((app) => liftPluginRuntime(installCustomRoutes(app)))
    )
  );

export const setupAllRoutes = (): PluginServer<void> =>
  pipe(
    useExpressApp((app) => app.use(bodyParser.json())),
    RTE.chain(installPluginCustomRoutes),
    RTE.chain(installBasicRoutes),
    RTE.chain(installFallbackHandlers),
    RTE.asUnit
  );

export const startServing = (): PluginServer<void> =>
  pipe(
    RTE.Do,
    RTE.bind('logger', askRootLogger),
    RTE.bind('cfg', askConfig),
    RTE.chain(({ logger, cfg }) =>
      useExpressApp((app) =>
        app.listen(cfg.port, cfg.address, () =>
          logger.info(`server is running on http://${cfg.address}:${cfg.port}`)
        )
      )
    )
  );
