import { IAuthMapper } from '../authmapper.js';
import { Either } from 'fp-ts/lib/Either';

export interface IsAuthResponse {
  authStatus: 'full' | 'partial' | 'none';
  authMessage: string;
  serialized(): unknown;
  roles: string[];
}

export type PluginOutputs = {
  [pluginName: string]: { output: unknown; roles: string[] };
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

export type PluginRoleMap = {
  [pluginName: string]: (pluginOutput: unknown) => string[];
};

type PluginRolesAuth = InvalidAuth | PartialAuth | FullAuth;

export default class PluginToRoleMapper
  implements IAuthMapper<PluginRolesAuth, PluginRolesAuth>
{
  private pluginHost: IPluginHost<InterfaceKind>; // Specify the correct InterfaceKind if needed
  private roleMap: PluginRoleMap;

  private constructor(
    pluginHost: IPluginHost<InterfaceKind>,
    roleMap: PluginRoleMap
  ) {
    this.pluginHost = pluginHost;
    this.roleMap = roleMap;
  }

  static initialize(
    pluginHost: IPluginHost<InterfaceKind>,
    roleMap: PluginRoleMap
  ): PluginToRoleMapper {
    return new PluginToRoleMapper(pluginHost, roleMap);
  }

  private determineAuthStatusAndMessage(
    valid: PMap<unknown>,
    errors: Set<string>
  ): { authStatus: 'full' | 'partial' | 'none'; authMessage: string } {
    let authStatus: 'full' | 'partial' | 'none';
    let authMessage: string;

    if (Object.keys(valid).length === 0) {
      authStatus = 'none';
      authMessage = 'No valid authentication data found.';
    } else if (errors.size > 0) {
      authStatus = 'partial';
      authMessage = `Partial authentication. Errors in: ${Array.from(
        errors
      ).join(', ')}.`;
    } else {
      authStatus = 'full';
      authMessage = 'All inputs were valid. Full authentication.';
    }

    return { authStatus, authMessage };
  }

  public async requestAuth(inputs: PMap<unknown>): Promise<PluginRolesAuth> {
    const resps: PMap<Either<string, unknown>> =
      await this.pluginHost.verifyProofAndGetOutput(inputs);
    const { errors: errorPlugins, valid } = splitPMap(resps);

    const errors = new Set<string>(Object.keys(errorPlugins));
    const { authStatus, authMessage } = this.determineAuthStatusAndMessage(
      valid,
      errors
    );

    const acquiredRoles = new Set<string>();
    const outputs: PluginOutputs = {};

    Object.keys(valid).forEach((pluginName) => {
      const output = valid[pluginName];
      const roles = this.roleMap[pluginName](output);
      roles.forEach((role) => acquiredRoles.add(role));
      outputs[pluginName] = { output, roles };
    });

    return {
      authStatus,
      authMessage,
      serialized: () => ({}),
      roles: Array.from(acquiredRoles),
      outputs
    };
  }

  public async checkAuthValidity(
    outputRoleMap: PluginOutputs
  ): Promise<PluginRolesAuth> {
    const outputs: PMap<unknown> = Object.keys(outputRoleMap).reduce(
      (acc, pluginName) => {
        acc[pluginName] = outputRoleMap[pluginName].output;
        return acc;
      },
      {}
    );

    const resps: PMap<OutputValidity> =
      await this.pluginHost.checkOutputValidity(outputs);

    const errors = new Set<string>();
    const valid = {};

    Object.entries(resps).forEach(([pluginName, validity]) => {
      if (!validity.isValid) {
        errors.add(pluginName);
      } else {
        valid[pluginName] = outputRoleMap[pluginName].output; // Assuming valid means it exists in outputRoleMap
      }
    });

    const { authStatus, authMessage } = this.determineAuthStatusAndMessage(
      valid,
      errors
    );

    const roles = new Set<string>();
    Object.keys(outputRoleMap).forEach((pluginName) => {
      if (valid[pluginName]) {
        // If valid (exists in the `valid` map), add roles
        outputRoleMap[pluginName].roles.forEach((role) => roles.add(role));
      }
    });

    return {
      authStatus,
      authMessage,
      serialized: () => ({}),
      roles: Array.from(roles),
      outputs: outputRoleMap
    };
  }
}
