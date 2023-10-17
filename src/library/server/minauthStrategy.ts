// TODO this module is very provisional
// and should be redesigned and reimplemented
// in particular:
// - MinAuthStrategy should be a base class used to implement
//   authorization strategies such as JWT strategy.
// - It should not make anm assumption about the "user model"
// - It should make it possible to use different and combined
//   proof verification / MinAuth plugins

import axios from 'axios';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { JsonProof } from 'o1js';

export interface MinAuthProof {
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

const verifyProof = (
  proverUrl: string,
  data: MinAuthProof
): Promise<VerificationResult> => {
  console.log('Calling for proof verification with:', data);
  return axios.post(proverUrl, data).then(
    (resp) => {
      if (resp.status == 200) {
        console.log('Received response:', resp);
        const { output, proofKey } = resp.data as {
          output: unknown;
          proofKey: string;
        };
        return { __tag: 'success', output, proofKey };
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
  proofKey: string;
};

class MinAuthStrategy extends Strategy {
  name = 'MinAuthStrategy';

  readonly verifyProof: (_: MinAuthProof) => Promise<VerificationResult>;

  public constructor(proverUrl: string = 'http://127.0.0.1:3001/verifyProof') {
    super();

    this.verifyProof = (data) => verifyProof(proverUrl, data);
  }

  async authenticate(req: Request): Promise<void> {
    console.log('authenticating (strategy) with req:', req.body);
    const loginData = req.body as MinAuthProof; // TODO validate the body
    const result = await this.verifyProof(loginData);

    if (result.__tag == 'success') {
      const { output, proofKey } = result;

      console.debug('proof verification output:', output);

      const authResp: AuthenticationResponse = {
        plugin: loginData.plugin,
        output,
        proofKey
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
