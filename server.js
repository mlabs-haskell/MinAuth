const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const passport = require('passport');
const passportJWT = require("passport-jwt");

const MinAuthStrategy = require('./minauthStrategy');

const SECRET_KEY = "YOUR_SECRET_KEY";


const app = express();

const refreshTokenStore = {};

// Initialize Passport

// with JWTStrategy
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

const jwtOptions = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: SECRET_KEY
};

passport.use(new JWTStrategy(jwtOptions, (jwtPayload, done) => {
    // In a real-world application, you'd verify the user's existence in your DB.
    // For this example, we'll just return the payload.
    console.log("JWT payload received:", jwtPayload);

    // Here, typically you'd verify the user's existence in your DB.
    // For this example, we'll just return the payload.
    if (jwtPayload) {
        return done(null, jwtPayload);
    } else {
        console.log("JWT verification failed");
        return done(null, false);
    }
}));

// with MinaAuthStrategy
passport.use(new MinAuthStrategy());

app.use(passport.initialize());

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Debug Middleware to log errors
app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    res.status(500).send('Something broke!');
});

app.get('/', (_req, res) => {
    res.send('Hello, World!');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.post('/login',
    passport.authenticate('custom', { session: false }),
    (req, res) => {
        // Store the refresh token
        refreshTokenStore[req.user.refreshToken] = req.user;

        res.json({
            message: `Hello, ${req.user.name}. You have the role: ${req.user.role}`,
            token: req.user.token,
            refreshToken: req.user.refreshToken
        });
    }
);

app.post('/token', (req, res) => {
    const refreshToken = req.body.refreshToken;

    if (refreshToken && refreshToken in refreshTokenStore) {
        const user = refreshTokenStore[refreshToken];
        const jwtPayload = {
            sub: user.id,
            name: user.name,
            role: user.role
        };
        const token = jwt.sign(jwtPayload, SECRET_KEY, { expiresIn: '1h' });

        res.json({ token });
    } else {
        res.status(401).json({ message: "Invalid refresh token" });
    }
});

app.get('/protected',
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
        res.send(`Hello, ${req.user.name}. You are accessing a protected route.`);
    }
);
