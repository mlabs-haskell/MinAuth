import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { MinAuthProof, MinAuthPluginInputSchema } from '../common/proof.js';
import { Logger } from '../plugin/logger.js';
import AuthMapper from './authmapper.js';


export interface MinAuthStrategyConfig {
  logger: Logger;
  authMapper: AuthMapper;
}

/**
 * TODO: in progress.
 * Minauth's integration with passport.js.
 */
class MinAuthStrategy extends Strategy {
  name = 'MinAuthStrategy';

  readonly authMapper: AuthMapper;

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

    if (authResp.verificationResult.__tag == 'success') {

      this.log.debug('proof verification output:', authResp.output);

      this.success(authResp);
    } else {
      const { error } = authResp.verificationResult;

      this.log.info(`unable to authenticate using minAuth: ${error}`);

      this.fail({ message: 'Proof validation was not succesful' }, 401);
    }
  }
}

export default MinAuthStrategy;
