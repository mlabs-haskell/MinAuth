import axios from 'axios';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JsonProof } from 'o1js';

const PROVER_URL: string = 'http://localhost:3001/verifyProof';
const SECRET_KEY: string = 'YOUR_SECRET_KEY';

interface MinAuthProof {
    entrypoint: {
        name: string;
        config: never;
    };
    proof: JsonProof;
}

interface User {
    id: number;
    name: string;
    role: string;
    token?: string;
    refreshToken?: string;
}

type VerificationResult = {
    role: string;
    message: string;
};

async function verifyProof(
    entryName: string,
    config: never,
    proof: JsonProof,
): Promise<VerificationResult> {
    if (!proof) throw 'Proof cannot be empty';

    const data: MinAuthProof = {
        entrypoint: {
            name: entryName,
            config: config,
        },
        proof: proof,
    };

    console.log('Calling for proof verification with:', data);
    const response = await axios.post(PROVER_URL, data);
    console.log('Received response:', response);
    return response.data;
}

class MinAuthStrategy extends Strategy {
    name = 'MinAuthStrategy';

    public constructor() {
        super();
    }

    async authenticate(req: Request, _options?: any): Promise<void> {
        try {
            console.log('authenticating (strategy) with req:', req.body);
            const loginData = req.body;
            const { entrypoint, proof } = loginData as MinAuthProof;
            const { name, config } = entrypoint;
            const { role, message } = await verifyProof(name, config, proof);
            console.log('proof verification return message is:', message);
            console.log('proof verification return role is:', role);

            if (proof && role) {
                const user: User = {
                    id: 1,
                    name: 'John Doe2',
                    role: role,
                };

                const jwtPayload = {
                    sub: user.id,
                    name: user.name,
                    role: user.role,
                };
                const jwtOptions = {
                    expiresIn: '1h',
                };
                const token = jwt.sign(jwtPayload, SECRET_KEY, jwtOptions);

                user.token = token;

                const refreshToken = crypto.randomBytes(40).toString('hex');
                user.refreshToken = refreshToken;

                return this.success(user);
            } else {
                return this.fail({ message: 'Invalid serialized proof' }, 401);
            }
        } catch (error: unknown) {
            this.error(error as Error);
        }
    }
}

export default MinAuthStrategy;
