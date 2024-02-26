import * as expressCore from 'express-serve-static-core';
import { Either } from 'fp-ts/lib/Either.js';
import {
  OutputValidity,
  TsInterfaceType,
  tsInterfaceTag
} from '../plugin-promise-api.js';
import { IPluginHost, PMap } from '../pluginhost.js';

export default class PluginServerProxyHost
  implements IPluginHost<TsInterfaceType>
{
  __interface_tag: TsInterfaceType = tsInterfaceTag;

  verifyProofAndGetOutput(
    inputs: PMap<unknown>
  ): Promise<PMap<Either<string, unknown>>> {
    // fore each plugin make a request to the plugin server
    // then combine the results into a single map taking into account the errors
    throw new Error('Method not implemented.');
  }

  checkOutputValidity(output: PMap<unknown>): Promise<PMap<OutputValidity>> {
    throw new Error('Method not implemented.');
  }

  isReady(): Promise<boolean> {
    // do a health check on the plugin server
    throw new Error('Method not implemented.');
  }

  activePluginNames(): Promise<string[]> {
    // get the list of active plugins from the plugin server
    throw new Error('Method not implemented.');
  }

  installCustomRoutes(app: expressCore.Express): Promise<void> {
    // for each plugin, get the custom routes from the plugin server and install them into the app
    throw new Error('Method not implemented.');
  }
}
