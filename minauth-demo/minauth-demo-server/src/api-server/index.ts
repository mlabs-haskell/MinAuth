import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import axios from 'axios';
import { Logger } from 'tslog';
import {
  JWTPayload,
  setupPassport,
  signJWTPayload,
  storeAuthResponse,
  getAuthResponseByToken,
  invalidateRefreshToken,
  hashAuthResp
} from './setup_jwt_passport.js';
import MinAuthStrategy, {
  AuthenticationResponse
} from 'minauth/dist/server/minauthstrategy.js';

const app = express();
const PORT: number = 3000;
const log = new Logger();

// Set up passport.js for authentication
const passport = setupPassport();

// Plugin server configuration
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

// Allowed origins for CORS
const allowedOrigins = [
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004'
];

// Middleware setup
app.use(bodyParser.json());
app.use(cors({ origin: allowedOrigins }));
if (pluginServerProxyConfig) {
  app.use('/plugins', createProxyMiddleware(pluginServerProxyConfig));
}

// Server start
app.listen(PORT, () => {
  log.info(`Server is running on http://127.0.0.1:${PORT}`);
});

// Login route
app.post(
  '/login',
  passport.authenticate(MinAuthStrategy.name, { session: false }),
  async (req: Request, res: Response) => {
    try {
      const authResp = req.user as AuthenticationResponse;
      const jwtPayload: JWTPayload = {
        authRespHash: await hashAuthResp(authResp)
      };
      const token = signJWTPayload(jwtPayload);
      const { refreshToken } = await storeAuthResponse(authResp);

      res.json({ message: 'success', token, refreshToken });
    } catch (error) {
      log.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Validate output from plugin
const validateOutput = async (
  plugin: string,
  output: unknown
): Promise<boolean> => {
  try {
    const response = await axios.post(`${pluginServerUrl}/validateOutput`, {
      plugin,
      output
    });
    return response.status === 200;
  } catch (error) {
    log.error('Validation error:', error);
    return false;
  }
};

// Token refresh route
app.post(
  '/token',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const authResp = await getAuthResponseByToken({ refreshToken });

      if (!refreshToken || !authResp) {
        res.status(401).json({ message: 'invalid refresh token' });
        return;
      }

      if (!(await validateOutput(authResp.plugin, authResp.output))) {
        await invalidateRefreshToken(refreshToken);
        res.status(401).json({ message: 'output no longer valid' });
        return;
      }

      const token = signJWTPayload({
        authRespHash: await hashAuthResp(authResp)
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
    res.send({ message: `You are accessing a protected route.` });
  }
);

// Health check route
app.get('/health', (_: Request, res: Response) => {
  res.status(200).json({ message: 'OK' });
});
