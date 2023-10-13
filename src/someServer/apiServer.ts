import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import MinAuthStrategy, {
  AuthenticationResponse
} from '@lib/server/minauthStrategy';
import { setupPassport } from './passport';

const SECRET_KEY: string = 'YOUR_SECRET_KEY';

const app = express();

const refreshTokenStore: Record<string, AuthenticationResponse> = {};

const passport = setupPassport(SECRET_KEY);

// Middleware to parse JSON requests
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.send('Hello, World!');
});

const PORT: number = 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

type JWTPayload = {
  plugin: string;
  proofKey: string;
};

const generateRefershToken = () => crypto.randomBytes(40).toString('hex');

const signJWTPayload = (payload: object) =>
  jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

app.post(
  '/login',
  passport.authenticate(MinAuthStrategy.name, { session: false }),
  (req: Request, res: Response) => {
    const authResp = req.user as AuthenticationResponse;

    const jwtPayload: JWTPayload = {
      plugin: authResp.plugin,
      proofKey: authResp.proofKey
    };

    const token = signJWTPayload(jwtPayload);
    const refreshToken = generateRefershToken();

    // Store the refresh token
    refreshTokenStore[refreshToken] = authResp;

    res.json({
      message: 'success',
      token,
      refreshToken
    });
  }
);

// TODO: invalidate a refresh token once the latest jwt expires. This can be easily implemented with redis.
// TODO: communicate with the plugin server to make sure that the proof is still valid
app.post('/token', (req: Request, res: Response) => {
  const refreshToken = req.body.refreshToken;

  if (refreshToken && refreshToken in refreshTokenStore) {
    const authResp = refreshTokenStore[refreshToken];

    const token = signJWTPayload(authResp);

    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// FIXME: not sure what to do about this route
// app.get(
//   '/protected',
//   passport.authenticate('jwt', { session: false }),
//   (req: Request, res: Response) => {
//     const user = req.user as StoredUser;
//     res.send(`Hello, ${user.name}. You are accessing a protected route.`);
//   }
// );
