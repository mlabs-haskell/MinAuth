import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import passport from 'passport';
import passportJWT from 'passport-jwt';

import MinAuthStrategy from '@lib/server/minauthStrategy'

const SECRET_KEY: string = 'YOUR_SECRET_KEY';

const app = express();

interface StoredUser {
    id: number;
    name: string;
    role: string;
    token: string;
    refreshToken: string;
}

const refreshTokenStore: Record<string, StoredUser> = {};

// with JWTStrategy
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

const jwtOptions = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: SECRET_KEY,
};

passport.use(
    new JWTStrategy(jwtOptions, (jwtPayload, done) => {
        console.log('JWT payload received:', jwtPayload);

        if (jwtPayload) {
            return done(null, jwtPayload);
        } else {
            console.log('JWT verification failed');
            return done(null, false);
        }
    }),
);

// with MinAuthStrategy
passport.use(new MinAuthStrategy());

app.use(passport.initialize());

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Debug Middleware to log errors
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.stack);
    res.status(500).send('Something broke!');
});

app.get('/', (_req, res) => {
    res.send('Hello, World!');
});

const PORT: number = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.post(
    '/login',
    passport.authenticate(MinAuthStrategy.name, { session: false }),
    (req: Request, res: Response) => {
        const user = req.user as StoredUser;

        // Store the refresh token
        refreshTokenStore[user.refreshToken] = user;

        res.json({
            message: `Hello, ${user.name}. You have the role: ${user.role}`,
            token: user.token,
            refreshToken: user.refreshToken,
        });
    },
);

app.post('/token', (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken;

    if (refreshToken && refreshToken in refreshTokenStore) {
        const user = refreshTokenStore[refreshToken];
        const jwtPayload = {
            sub: user.id,
            name: user.name,
            role: user.role,
        };
        const token = jwt.sign(jwtPayload, SECRET_KEY, { expiresIn: '1h' });

        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

app.get(
    '/protected',
    passport.authenticate('jwt', { session: false }),
    (req: Request, res: Response) => {
        const user = req.user as StoredUser;
        res.send(`Hello, ${user.name}. You are accessing a protected route.`);
    },
);
