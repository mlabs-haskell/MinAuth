import MinAuthStrategy from '@lib/server/minauthStrategy';
import passport from 'passport';
import passportJWT from 'passport-jwt';

export const setupPassport = (secret: string) => {
  const JWTStrategy = passportJWT.Strategy;
  const ExtractJWT = passportJWT.ExtractJwt;

  const jwtOptions = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: secret
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
