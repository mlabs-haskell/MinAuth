const Strategy = require('passport-strategy');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET_KEY = "YOUR_SECRET_KEY";

// async function mockVerifyProof(serializedProof, done) {
//     // Dummy validation for the proof. Here, you should replace with your actual validation logic.
//     if (serializedProof && serializedProof === "VALID_TOKEN") {
//         // Mock user object based on the provided serialized proof
//         const user = {
//             id: 1,
//             name: "John Doe",
//             role: "admin"
//         };
//         // If validation is successful, we "log in" the user
//         return done(null, user);
//     } else {
//         // If validation fails, the authentication is considered a failure.
//         return done(null, false, { message: "Invalid serialized proof" });
//     }
// }

class MinAuthStrategy extends Strategy {
    static get name() {
        return 'minauth';
    }
    constructor() {
        super();

        // Name of the strategy
        this.name = MinAuthStrategy.name;
    }

    authenticate(req, _options) {
        const serializedProof = req.body.serializedProof;

        if (serializedProof && serializedProof === "VALID_TOKEN") {
            const user = {
                id: 1,
                name: "John Doe2",
                role: "admin"
            };

            // Create a JWT
            const jwtPayload = {
                sub: user.id,
                name: user.name,
                role: user.role
            };
            const jwtSecret = SECRET_KEY;  // Change to a strong, environment-specific secret in production
            const jwtOptions = {
                expiresIn: '1h'  // Token expiration time
            };
            const token = jwt.sign(jwtPayload, jwtSecret, jwtOptions);

            // Add token to user object
            user.token = token;

            // Create a refresh token
            const refreshToken = crypto.randomBytes(40).toString('hex');

            // Add refresh token to user object
            user.refreshToken = refreshToken;

            return this.success(user);
        } else {
            return this.fail({ message: "Invalid serialized proof" }, 401);
        }
    }

}

module.exports = MinAuthStrategy;
