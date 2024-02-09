// TODO use logger
import axios from 'axios';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { MinAuthProof, MinAuthPluginInputSchema } from '../common/proof.js';
import { Logger } from '../plugin/logger.js';

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
  data: MinAuthProof,
  log: Logger
): Promise<VerificationResult> => {
  log.info('Calling for proof verification with:', data);
  return axios.post(verifierUrl, data).then(
    (resp) => {
      if (resp.status == 200) {
        log.info('Received response:', resp);
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

export interface MinAuthStrategyConfig {
  logger: Logger;
  authMapper: AuthMapper;
}

/**
 * Minauth's integration with passport.js.
 * This implementation uses the plugin server to verify the proof.
 */
class MinAuthStrategy extends Strategy {
  name = 'MinAuthStrategy';

  readonly verifyProof: (_: MinAuthProof) => Promise<VerificationResult>;
  readonly log: Logger;

  public constructor(config: MinAuthStrategyConfig) {
    super();
    this.log = config.logger;
  }

  async authenticate(req: Request): Promise<void> {
    this.log.info('authenticating (strategy) with req:', req.body);
    const loginData = this.authMapper.requestAuthSchema.parse(req.body)

    // forward the proof verification to the plugin server
    const result = await this.authMapper.requestAuth(loginData)

    if (result.__tag == 'success') {
      const { output } = result;

      this.log.debug('proof verification output:', output);

      const authResp: AuthenticationResponse = {
        plugin: loginData.plugin,
        output
      };

      this.success(authResp);
    } else {
      const { error } = result;

      this.log.info(`unable to authenticate using minAuth: ${error}`);

      this.fail({ message: 'Proof validation was not succesful' }, 401);
    }
  }
}

export default MinAuthStrategy;
