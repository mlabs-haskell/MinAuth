import bodyParser from 'body-parser';
import * as expressCore from 'express-serve-static-core';
import * as RTE from 'fp-ts/lib/ReaderTaskEither.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import { z } from 'zod';
import { wrapTrivialExpressHandler } from '../../plugin/express.js';
import { OutputValidity } from '../../plugin/plugintype.js';
import {
  installCustomRoutes,
  validateOutput,
  verifyProof
} from '../../server/plugin-fp-api.js';
import {
  PluginRuntimeEnv,
  askActivePluginNames
} from '../../server/pluginruntime.js';
import { launchTE, liftZodParseResult } from '../../utils/fp/taskeither.js';
import {
  PluginServer,
  askConfig,
  askPluginRuntimeEnv,
  askRootLogger,
  liftPluginRuntime,
  useExpressApp,
  useRootLogger,
  withExpressApp
} from './types.js';
import { MinAuthProofSchema } from '../../common/proof.js';

/** Handle a POST request to /verifyProof */
const handleVerifyProof = (env: PluginRuntimeEnv) =>
  wrapTrivialExpressHandler((req) => {
    const parseResults = MinAuthProofSchema.safeParse(req.body);
    if (!parseResults.success) {
      env.logger.info(
        `Failed to parse incoming MinAuthProof:\b ${parseResults.error}`
      );
      return TE.left('Failed to parse incoming MinAuthProof');
    }
    const body = parseResults.data;
    env.logger.info(`Parsed incoming MinAuthProof with body:\b ${body}`);

    return pipe(
      verifyProof(body.proof, body.publicInputArgs, body.plugin)(env),
      TE.map((output) => {
        return { output };
      }),
      TE.mapLeft(() => 'unknown error')
    );
  });

const validateOutputDataSchema = z.object({
  plugin: z.string(),
  output: z.unknown()
});

type ValidateOutputData = z.infer<typeof validateOutputDataSchema>;

/** Handle a GET request to /activePlugins */
const handleActivePlugins = (env: PluginRuntimeEnv) =>
  wrapTrivialExpressHandler(() => {
    return askActivePluginNames()(env);
  });

/** Handle a POST request to /validateOutput */
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
          (val: OutputValidity) => () =>
            val.isValid
              ? resp.status(200).json({})
              : resp.status(400).json({ message: val.reason })
        ),
        TE.asUnit
      )
    );

/**
 * Install the basic routes for the plugin server:
 * - POST /verifyProof
 * - POST /validateOutput
 * - GET /health
 */
const installBasicRoutes = (): PluginServer<void> =>
  pipe(
    askPluginRuntimeEnv(),
    RTE.chain((env) =>
      useExpressApp((app) =>
        app
          .use(bodyParser.json())
          .post('/verifyProof', handleVerifyProof(env))
          .post('/validateOutput', handleValidateOutput(env))
          .get('/plugins/activePlugins', handleActivePlugins(env))
          .get('/health', (_, resp) => resp.status(200).json({}))
      )
    )
  );

/**
 * If a request is not handled by any of the routes above,
 * Return a 404 error and 500 if an error occurs.
 */
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

/**
 * Plugins can define their own routes to communicate with provers.
 */
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

/**
 * Calls app.listen() to start serving the plugin server
 * the configuration is read from the plugin server environment
 */
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
