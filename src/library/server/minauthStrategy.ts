import axios from 'axios';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JsonProof } from 'o1js';

interface MinAuthProof {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

type VerificationResult =
  | {
      __tag: 'success';
      output: unknown;
      proofKey: string;
    }
  | {
      __tag: 'failed';
      error: string;
    };

async function verifyProof(
  proverUrl: string,
  data: MinAuthProof
): Promise<VerificationResult> {
  console.log('Calling for proof verification with:', data);
  const response = await axios.post(proverUrl, data);

  if (response.status == 200) {
    console.log('Received response:', response);
    const { output, proofKey } = response.data as {
      output: unknown;
      proofKey: string;
    };
    return { __tag: 'success', output, proofKey };
  } else {
    const { error } = response.data as { error: string };
    return { __tag: 'failed', error };
  }
}

type JWTPayload = {
  plugin: string;
  proofKey: string;
};

type AuthenticationResponse = {
  output: unknown;
  jwtToken: string;
  refreshToken: string;
};

class MinAuthStrategy extends Strategy {
  name = 'MinAuthStrategy';

  readonly signJWT: (_: JWTPayload) => string;
  readonly verifyProof: (_: MinAuthProof) => Promise<VerificationResult>;

  public constructor(
    secretKey: string,
    proverUrl: string = 'http://localhost:3001/verfiyProof',
    expiresIn: string = '1h'
  ) {
    super();

    const jwtOptions = { expiresIn };
    this.signJWT = (payload) => jwt.sign(payload, secretKey, jwtOptions);
    this.verifyProof = (data) => verifyProof(proverUrl, data);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  async authenticate(req: Request, _options?: any): Promise<void> {
    console.log('authenticating (strategy) with req:', req.body);
    const loginData = req.body as MinAuthProof; // TODO validate the body
    const result = await this.verifyProof(loginData);

    if (result.__tag == 'success') {
      const { output, proofKey } = result;
      console.log('proof verification output is:', output);

      const jwtPayload: JWTPayload = {
        plugin: loginData.plugin,
        proofKey
      };

      const jwtToken = this.signJWT(jwtPayload);
      const refreshToken = crypto.randomBytes(40).toString('hex');

      const authResp: AuthenticationResponse = {
        output,
        jwtToken,
        refreshToken
      };

      this.success(authResp);
    } else {
      const { error } = result;

      this.error(Error(error));
    }
  }
}

export default MinAuthStrategy;
