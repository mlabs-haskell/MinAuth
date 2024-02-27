import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import { Either } from 'fp-ts/lib/Either.js';
import { FpInterfaceType, OutputValidity } from '../plugin-promise-api.js';
import { IPluginHost, PMap } from '../pluginhost.js';


export default class PluginServerProxyHost implements IPluginHost<FpInterfaceType> {
  __interface_tag: FpInterfaceType = 'fp';

  verifyProofAndGetOutput(
    inputs: { [plugin: string]: unknown }
  ): TaskEither<string, PMap<Either<string, unknown>>>{
    throw new Error('Method not implemented.');
  }

  checkOutputValidity(
    output: { [plugin: string]: unknown }
  ): TaskEither<string, PMap<OutputValidity>>{
    throw new Error('Method not implemented.');
  }

  isReady(): TaskEither<string, boolean> {
    throw new Error('Method not implemented.');
  }

  activePluginNames(): TaskEither<string, string[]> {
    throw new Error('Method not implemented.');
  }

  installCustomRoutes(app: any): TaskEither<string, void> {
    throw new Error('Method not implemented.');
  }
}
