import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { Logger } from '../plugin/logger.js';
import { IAuthMapper, fpToTsAuthMapper } from './authmapper.js';
import {
  FpInterfaceType,
  InterfaceKind,
  TsInterfaceType
} from './plugin-promise-api.js';

/** An auxilliary abbrevation */
type AuthMapper<If extends InterfaceKind, AuthReq, AuthResp> = IAuthMapper<
  If,
  AuthReq,
  AuthResp,
  unknown,
  unknown
>;

/**
 *  Configuration for the MinAuthBinaryStrategy
 *  The actual work is forwarded to the authmapper.
 *  The strategy retain only fully successful authentications.
 *  And implements the passport.js strategy interface.
 */
export interface MinAuthStrategyConfig<AuthReq, AuthResp> {
  logger: Logger;
  authMapper:
    | AuthMapper<FpInterfaceType, AuthReq, AuthResp>
    | AuthMapper<TsInterfaceType, AuthReq, AuthResp>;
}
/**
 * Represents the response from an authentication request, encapsulating the status
 * and message related to the authentication process, along with a method for serialization.
 */
export interface IsAuthResponse {
  /** Indicates the level of authentication achieved.
   *  - `'full'` indicates that the all the plugins have authenticated the user.
   *  - `'partial'` indicates that some of the plugins have authenticated the user.
   *  - `'none'` indicates that none of the plugins have authenticated the user.
   */
  authStatus: 'full' | 'partial' | 'none';

  /** A descriptive message providing details about the authentication process or its outcome. */
  authMessage: string;
}

/**
 * Minauth's integration with passport.js.
 * It is very simple to create your own following this one as an example.
 * This strategy, given an authmapper will forward its authresponse only
 * it it has fully succeeded.
 * (In theory the auth mapper can return a partial success - the authenticating
 * user receives maximal authority given the input.)
 */
export default class MinAuthBinaryStrategy<
  AuthReq,
  AuthResp extends IsAuthResponse
> extends Strategy {
  name = 'MinAuthBinaryStrategy';

  readonly authMapper: AuthMapper<TsInterfaceType, AuthReq, AuthResp>;

  readonly log: Logger;

  public constructor(config: MinAuthStrategyConfig<AuthReq, AuthResp>) {
    super();
    this.log = config.logger;
    if (config.authMapper.__interface_tag === 'fp') {
      this.authMapper = fpToTsAuthMapper(config.authMapper);
    } else {
      this.authMapper = config.authMapper;
    }
  }

  async authenticate(req: Request): Promise<void> {
    this.log.info('called `authenticate` with request body:', req.body);
    this.log.debug('Parsing request body.');

    const authReq: AuthReq | undefined =
      this.authMapper.authRequestEncDecoder.decode(req.body);

    if (!authReq) {
      const message =
        'Failed to parse authentication request. Consult the strategy AuthMapper.';
      this.fail({ message }, 400);
      return;
    }

    const authResp = await this.authMapper.requestAuth(authReq);

    const authRespSerialized =
      this.authMapper.authResponseEncDecoder.encode(authResp);

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
