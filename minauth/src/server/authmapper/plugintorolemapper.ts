import AuthMapper from '../authmapper.js'

default export class PluginToRoleMapper<AuthReqBody, AuthResponse> extends AuthMapper{

  public static async initialize(pluginHost: IPluginHost, pluginRoleMapping: PluginRoleMapping){

  }

  public async requestAuth(authRequestBody: AuthReqBody): Promise<AuthResponse> {}

  public async checkAuthValidity(authResponse: AuthResponse) {}

  readonly requestAuthSchema: z.ZodSchema<AuthReqBody> = z.unknown()

};
