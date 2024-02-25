import { IAuthMapper } from '../authmapper.js';
import { Either } from 'fp-ts/lib/Either.js';
import { IPluginHost, PMap, fpToTsPluginHost, splitPMap } from '../ipluginhost.js';
import { FpInterfaceType, TsInterfaceType, fpInterfaceTag } from '../../plugin/interfacekind.js';
import { OutputValidity } from '../../plugin/plugintype.js';
/**
 * Represents an authentication response with details on the authentication status, message, and roles.
 */
export interface IsAuthResponse {
  authStatus: 'full' | 'partial' | 'none';
  authMessage: string;
  serialized(): unknown;
  roles: string[];
}

/**
 * Type for mapping auth plugin names to their outputs and associated roles.
 */
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

/**
 * Class for mapping plugin outputs to roles and determining authentication status based on the outputs of various plugins.
 * This class implements the `IAuthMapper` interface, providing a concrete implementation for authentication processes
 * that involve mapping specific plugin outputs to user roles and deciding on the overall authentication status (full, partial, none)
 * based on the collective output from all involved plugins that involves the union of roles from all plugins.
 *
 * Usage:
 * To use this class, first initialize it with `PluginToRoleMapper.initialize(pluginHost, roleMap)`, providing an `IPluginHost` instance
 * and a `PluginRoleMap` that defines how to extract roles from plugin outputs. Then, use `requestAuth` to initiate the authentication
 * process with specific inputs, or `checkAuthValidity` to validate the current state of authentication based on plugin outputs.
 */
export default class PluginToRoleMapper
  implements IAuthMapper<PluginRolesAuth, PluginOutputs, PluginRolesAuth>
{
  private pluginHost: IPluginHost<TsInterfaceType>; // Specify the correct InterfaceKind if needed
  private roleMap: PluginRoleMap;

  extractValidityCheck(authResponse: PluginRolesAuth): PluginOutputs {
    if (authResponse.authStatus === 'none') {
      return {};
    }
    return authResponse.outputs;
  }

  private constructor(
    pluginHost: IPluginHost<FpInterfaceType> | IPluginHost<TsInterfaceType>,
    roleMap: PluginRoleMap
  ) {
    // if pluginhost is of fp interface type, convert it to ts interface type
    if (pluginHost.__interface_tag === fpInterfaceTag ) {
      this.pluginHost = fpToTsPluginHost(pluginHost);
    }
    else {
      this.pluginHost = pluginHost;
    }

    this.roleMap = roleMap;
  }

  static initialize(
    pluginHost: IPluginHost<FpInterfaceType> | IPluginHost<TsInterfaceType>,
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
      (acc: PMap<unknown>, pluginName: string) => {
        acc[pluginName] = outputRoleMap[pluginName].output;
        return acc;
      },
      {}
    );

    const resps: PMap<OutputValidity> =
      await this.pluginHost.checkOutputValidity(outputs);

    const errors = new Set<string>();
    const valid: PMap<unknown> = {};

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
