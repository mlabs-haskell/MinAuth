import crypto from 'crypto';
import passport from 'passport';
import passportJWT from 'passport-jwt';
import jwt from 'jsonwebtoken';
import MinAuthStrategy, {
  AuthenticationResponse
} from 'minauth/server/minauthstrategy';

// This is just for demonstration purposes, don't state you secrets publicly ;)
const SECRET_KEY: string = 'YOUR_SECRET_KEY';

/**
 * A helper for a particular passport.js setup
 */
export const setupPassport = () => {
  const JWTStrategy = passportJWT.Strategy;
  const ExtractJWT = passportJWT.ExtractJwt;

  const jwtOptions = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: SECRET_KEY
  };

  return passport
    .use(
      new JWTStrategy(jwtOptions, (jwtPayload, done) => {
        console.log('JWT payload received:', jwtPayload);

        if (jwtPayload) {
          return done(null, jwtPayload);
        } else {
          console.log('JWT verification failed');
          return done(null, false);
        }
      })
    )
    .use(new MinAuthStrategy());
};

// This example will use JWT based authentication and in-memory refresh token store.
export type JWTPayload = { authRespHash: string };
export const refreshTokenStore: Record<string, AuthenticationResponse> = {};
// some jwt-related helpers
export const generateRefreshToken = () =>
  crypto.randomBytes(40).toString('hex');
export const signJWTPayload = (payload: JWTPayload) =>
  jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
export const hashAuthResp = (a: AuthenticationResponse): string =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(a))
    .digest()
    .toString('hex');
