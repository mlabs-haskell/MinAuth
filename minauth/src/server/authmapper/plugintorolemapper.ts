import {IAuthMapper} from '../authmapper.js'

export interface IsAuthResponse {
  authStatus: 'full' | 'partial' | 'none';
  authMessage: string;
  serialized(): unknown;
  roles: string[];
};

export type PluginOutputs = {
  [pluginName: string]: { output: unknown, roles: string[]};
};

type InvalidAuth = {
  authStatus: 'none';
  authMessage: string;
  serialized(): unknown;
};

type PartialAuth = {
  authStatus: 'partial';
  authMessage: string;
  serialized(): unknown;
  roles: string[];
  outputs: PluginOutputs;
};

type FullAuth = {
  authStatus: 'full';
  authMessage: string;
  serialized(): unknown;
  roles: string[];
  outputs: PluginOutputs;
};

type PluginRolesAuth = InvalidAuth | PartialAuth | FullAuth;


export default class PluginToRoleMapper<AuthReqBody> implements IAuthMapper<PluginRolesAuth, PluginRolesAuth>{

  public async requestAuth(authRequestBody: AuthReqBody): Promise<PluginRolesAuth> {
    //TODO
    throw new Error('Method not implemented.');
  }

  public async checkAuthValidity(authResp: PluginRolesAuth): Promise<PluginRolesAuth> {
    //TODO
    throw new Error('Method not implemented.');
  }

};
