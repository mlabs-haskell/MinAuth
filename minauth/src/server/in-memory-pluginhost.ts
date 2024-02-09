import * as expressCore from 'express-serve-static-core';
import { IPluginHost } from "./ipluginhost";
import { IMinAuthPlugin } from '../plugin/plugintype.js';
import z from 'zod';

const PluginsSchema = z.object({
  plugins: z.array(
    z.object({
      name: z.string(),
      // TODO for interfaces and not types
      plugin: z.instanceof(IMinAuthPlugin<unknown, unknown, unknown>)
    })
  )
});

type Plugins = z.infer<typeof PluginsSchema>


export class InMemoryPluginHost implements IPluginHost {

  constructor(
    readonly plugins: Plugins
  ){}

  async verifyProofAndGetOutput(){

  }

  async checkOutputValidity(){
  }

  async isReady(){
    return true;
  }

  async activePluginNames(){
  }

  // this ties us into the express app
  async installCustomRoutes(app: expressCore.Express){
  }


}
