import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { Logger } from '../plugin/logger.js';
import { IAuthMapper, IsAuthResponse } from './authmapper.js';

/** An auxilliary abbrevation */
type AuthMapper = IAuthMapper<IsAuthResponse, unknown>;

/**
 *  Configuration for the MinAuthBinaryAuthStrategy
 *  The actual work is forwarded to the authmapper.
 *  The strategy retain only fully successful authentications.
 *  And implements the passport.js strategy interface.
 */
export interface MinAuthStrategyConfig {
  logger: Logger;
  authMapper: IAuthMapper<IsAuthResponse, unknown>;
}

/**
 * Minauth's integration with passport.js.
 * It is very simple to create your own following this one as an example.
 * This strategy, given an authmapper will forward its authresponse only
 * it it has fully succeeded.
 * (In theory the auth mapper can return a partial success - the authenticating
 * user receives maximal authority given the input.)
 */
export class MinAuthBinaryAuthStrategy extends Strategy {
  name = 'MinAuthBinaryAuthStrategy';

  readonly authMapper: AuthMapper;

  readonly log: Logger;

  public constructor(config: MinAuthStrategyConfig) {
    super();
    this.log = config.logger;
    this.authMapper = config.authMapper;
  }

  async authenticate(req: Request): Promise<void> {
    this.log.info('called `authenticate` with request body:', req.body);

    // forward the proof verification to the plugin server
    const authResp = await this.authMapper.requestAuth(req.body);
    const authRespSerialized = authResp.serialized();

    if (authResp.authStatus == 'full') {
      this.log.debug(
        'proof verification output:',
        JSON.stringify(authRespSerialized, null, 2)
      );

      this.success(authResp);
    } else {
      const message = `Authentication rejected: ${authResp.authMessage}`;
      this.log.debug(message);
      this.fail({ message }, 401);
    }
  }
}

export default MinAuthBinaryAuthStrategy;
