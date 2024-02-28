import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response
} from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { ILogObj, Logger } from 'tslog';
import {
  JWTPayload,
  setupPassport,
  signJWTPayload,
  storeAuthResponse,
  getAuthResponseByToken,
  invalidateRefreshToken,
  hashAuthResp
} from './setup_jwt_passport.js';
import PluginServerProxyHost from 'minauth/dist/server/pluginhost/plugin-server-proxy-host.js';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import {
  IPluginHost,
  fpToTsPluginHost
} from 'minauth/dist/server/pluginhost.js';
import PluginToRoleMapper, {
  PluginRolesAuth
} from 'minauth/dist/server/authmapper/plugin-to-role-mapper.js';
import MinAuthBinaryStrategy from 'minauth/dist/server/minauth-passport.js';

// The demo extensively uses the tslog library for logging.
const log = new Logger<ILogObj>();

// The example server specified in this module relies on an minauth plugin server instance
// to be runnning on the same machine.

const pluginServerConfig = {
  url: 'http://127.0.0.1',
  port: 3001,
  demoEnableProxy: true
};
const pluginServerUrl = `${pluginServerConfig.url}:${pluginServerConfig.port}`;

// Optional proxy middleware configuration
const pluginServerProxyConfig: Options | null =
  pluginServerConfig.demoEnableProxy
    ? { target: pluginServerUrl, changeOrigin: true, logLevel: 'debug' }
    : null;

// The standard way to interact with plugins is via a plugin host.
const setupPluginServerProxyHost = () => {
  const config = {
    serverUrl: pluginServerUrl,
    log: log.getSubLogger({ name: 'plugin-server-proxy-host' })
  };
  return fpToTsPluginHost(new PluginServerProxyHost(config));
};
const plugin_host: IPluginHost<TsInterfaceType> = setupPluginServerProxyHost();

// The most straightforwad way for minauth to provide authentication in an express.js app
// is via passport.js strategy.
// The Minauth passport js strategy should usually be written by users to match their needs
// but there's one that is implemented as an example.

// This strategy uses something called AuthMapper which basically maps authentication credentials
// back and forth between authentication plugins responses
type Role = 'user';

const roleMap: { [pluginName: string]: Role[] } = {
  'erc721-timelock': ['user'],
  'simple-preimage': ['user']
};

const authMapper = PluginToRoleMapper.initialize(
  plugin_host,
  roleMap,
  log.getSubLogger({ name: 'PluginToRoleMapper' })
);

const minauthStrategy = new MinAuthBinaryStrategy({
  logger: log.getSubLogger({ name: 'MinAuthStrategy' }),
  authMapper
});

// server constants

const app = express();
const PORT: number = 3000;

const passport = setupPassport(minauthStrategy);

// Allowed origins for CORS
const allowedOrigins = [
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004'
];

// Middleware setup

app.use(cors({ origin: allowedOrigins }));
if (pluginServerProxyConfig) {
  // Exclude proxied routes from consuming requests bodies by bodyparser.json midleware.
  const excludePath = (
    path: string,
    middleware: RequestHandler
  ): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith(path)) {
        next();
      } else {
        middleware(req, res, next);
      }
    };
  };
  app.use(excludePath('/plugins', bodyParser.json()));
  app.use('/plugins', createProxyMiddleware(pluginServerProxyConfig));
} else {
  app.use(bodyParser.json());
}

// Server start
app.listen(PORT, () => {
  log.info(`Server is running on http://127.0.0.1:${PORT}`);
});

// Login route
app.post(
  '/login',
  passport.authenticate(minauthStrategy.name, { session: false }),
  async (req: Request, res: Response) => {
    try {
      // the shape of the response comes from the authmapper that got used
      // TODO: how make it more clear and explicit (and maybe more typed)
      const authResp = req.user;
      log.debug('authResp:', authResp);
      const jwtPayload: JWTPayload = {
        authRespHash: hashAuthResp(authResp)
      };
      log.debug('jwtPayload:', jwtPayload);
      const token = signJWTPayload(jwtPayload);
      const { refreshToken } = await storeAuthResponse(authResp);

      res.json({ message: 'success', token, refreshToken });
    } catch (error) {
      log.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// // Validate output from plugin
// const validateOutput = async (
//   plugin: string,
//   output: unknown
// ): Promise<boolean> => {
//   try {
//     const response = await axios.post(`${pluginServerUrl}/validateOutput`, {
//       plugin,
//       output
//     });
//     return response.status === 200;
//   } catch (error) {
//     log.error('Validation error:', error);
//     return false;
//   }
// };

// Token refresh route

app.post(
  '/token',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const authRespSerialized = await getAuthResponseByToken({ refreshToken });
      const authResp: PluginRolesAuth | undefined =
        authMapper.authResponseEncDecoder.decode(authRespSerialized);

      if (!refreshToken || !authResp) {
        res.status(401).json({ message: 'invalid refresh token' });
        return;
      }

      if (authResp.authStatus == 'none') {
        res
          .status(401)
          .json({ message: 'invalid auth status - please login again' });
        return;
      }

      // when you refreh authentication the stored auth response should
      // be validated again, to make sure it's still valid
      const newAuthResp = await authMapper.checkAuthValidity(
        authMapper.extractValidityCheck(authResp)
      );
      const newAuthRespSerialized =
        authMapper.authResponseEncDecoder.encode(newAuthResp);

      // TODO:this will discard partially successful authentications
      // we may want to add an example that makes use of partial authentications
      const considerValid = newAuthResp.authStatus == 'full';

      if (!considerValid) {
        await invalidateRefreshToken(refreshToken);
        res.status(401).json({ message: 'output no longer valid' });
        return;
      }
      const token = signJWTPayload({
        authRespHash: hashAuthResp(newAuthRespSerialized)
      });
      res.status(200).json({ token });
    } catch (error) {
      log.error('Token error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Protected route example
app.get(
  '/protected',
  passport.authenticate('jwt', { session: false }),
  (_: Request, res: Response) => {
    log.info('GET /protected');
    res.send({ message: `You are accessing a protected route.` });
  }
);

// Health check route
app.get('/health', (_: Request, res: Response) => {
  log.info('GET /health');
  res.status(200).json({ message: 'OK' });
});
