// TODO use logger
import axios from 'axios';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { JsonProof } from 'o1js';

/**
 * The generic proof shape that can be verified by the plugin server.
 */
export interface MinAuthProof {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}

/**
 * A result of a proof verification.
 */
type VerificationResult =
  | {
      __tag: 'success';
      output: unknown;
    }
  | {
      __tag: 'failed';
      error: string;
    };

/**
 * Forward proof verification to a remote verifier.
 */
const verifyProof = (
  verifierUrl: string,
  data: MinAuthProof
): Promise<VerificationResult> => {
  console.log('Calling for proof verification with:', data);
  return axios.post(verifierUrl, data).then(
    (resp) => {
      if (resp.status == 200) {
        console.log('Received response:', resp);
        const { output } = resp.data as {
          output: unknown;
        };
        return { __tag: 'success', output };
      }

      const { error } = resp.data as { error: string };
      return { __tag: 'failed', error };
    },
    (error) => {
      return { __tag: 'failed', error: String(error) };
    }
  );
};

export type AuthenticationResponse = {
  plugin: string;
  output: unknown;
};

/**
 * Minauth's integration with passport.js.
 * This implementation uses the plugin server to verify the proof.
 */
class MinAuthStrategy extends Strategy {
  name = 'MinAuthStrategy';

  readonly verifyProof: (_: MinAuthProof) => Promise<VerificationResult>;

  public constructor(
    verifierUrl: string = 'http://127.0.0.1:3001/verifyProof'
  ) {
    super();

    this.verifyProof = (data) => verifyProof(verifierUrl, data);
  }

  async authenticate(req: Request): Promise<void> {
    console.log('authenticating (strategy) with req:', req.body);
    const loginData = req.body as MinAuthProof; // TODO validate the body
    // forward the proof verification to the plugin server
    const result = await this.verifyProof(loginData);

    if (result.__tag == 'success') {
      const { output } = result;

      console.debug('proof verification output:', output);

      const authResp: AuthenticationResponse = {
        plugin: loginData.plugin,
        output
      };

      this.success(authResp);
    } else {
      const { error } = result;

      console.log(`unable to authenticate using minAuth: ${error}`);

      this.fail(400);
    }
  }
}

export default MinAuthStrategy;
