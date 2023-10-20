import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import MinAuthStrategy, {
  AuthenticationResponse
} from '@lib/server/minauthStrategy';
import { setupPassport } from './passport';
import axios from 'axios';

const SECRET_KEY: string = 'YOUR_SECRET_KEY';

const app = express();

const refreshTokenStore: Record<string, AuthenticationResponse> = {};

const passport = setupPassport(SECRET_KEY);

// Middleware to parse JSON requests
app.use(bodyParser.json());

const PORT: number = 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

type JWTPayload = { authRespHash: string };

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const signJWTPayload = (payload: JWTPayload) =>
  jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

const hashAuthResp = (a: AuthenticationResponse): string =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(a))
    .digest()
    .toString('hex');

app.post(
  '/login',
  passport.authenticate(MinAuthStrategy.name, { session: false }),
  (req: Request, res: Response) => {
    const authResp = req.user as AuthenticationResponse;

    console.log(authResp);

    const jwtPayload: JWTPayload = { authRespHash: hashAuthResp(authResp) };

    const token = signJWTPayload(jwtPayload);
    const refreshToken = generateRefreshToken();

    // Store the refresh token
    refreshTokenStore[refreshToken] = authResp;

    res.json({
      message: 'success',
      token,
      refreshToken
    });
  }
);

const validateOutput = (plugin: string, output: unknown): Promise<boolean> =>
  axios
    .post('http://127.0.0.1:3001/validateOutput', {
      plugin,
      output
    })
    .then(({ status }) => status == 200);

// TODO: Prevent the reuse of jwt.
// TODO: invalidate a refresh token once the latest jwt expires. This can be easily implemented with redis
app.post(
  '/token',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken;

    if (!(refreshToken && refreshToken in refreshTokenStore)) {
      res.status(401).json({ message: 'invalid refresh token' });
      return;
    }

    const authResp = refreshTokenStore[refreshToken];

    const { authRespHash } = req.user as JWTPayload;

    console.log(JSON.stringify(authResp));

    if (hashAuthResp(authResp) !== authRespHash) {
      res.status(401).json({ message: 'invalid refresh token' });
      return;
    }

    const validationResult = await validateOutput(
      authResp.plugin,
      authResp.output
    );

    if (!validationResult) {
      delete refreshTokenStore[refreshToken];
      res.status(401).json({ message: 'output no longer valid' });
      return;
    }

    const token = signJWTPayload({ authRespHash });
    res.status(200).json({ token });
  }
);

app.get(
  '/protected',
  passport.authenticate('jwt', { session: false }),
  (req: Request, res: Response) => {
    res.send({ message: `You are accessing a protected route.` });
  }
);
