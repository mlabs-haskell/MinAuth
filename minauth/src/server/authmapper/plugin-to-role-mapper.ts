import { IAuthMapper } from '../authmapper.js';
import { Either } from 'fp-ts/lib/Either.js';
import {
  IPluginHost,
  PMap,
  PluginInputsSchema,
  PluginInputs,
  fpToTsPluginHost,
  splitPMap
} from '../pluginhost.js';
import {
  FpInterfaceType,
  TsInterfaceType,
  fpInterfaceTag,
  tsInterfaceTag
} from '../../plugin/interfacekind.js';
import { OutputValidity } from '../../plugin/plugintype.js';
import { z } from 'zod';
import { EncodeDecoder, wrapZodDec } from '../../plugin/encodedecoder.js';
import { Logger } from '../../plugin/logger.js';

const PluginOutputSchema = z.record(
  z.string(),
  z.object({
    output: z.unknown(), // plugin dependent
    roles: z.array(z.string())
  })
);

/**
 * Type for mapping auth plugin names to their outputs and associated roles.
 */
export type PluginOutputs = z.infer<typeof PluginOutputSchema>;

// Define schemas for InvalidAuth, PartialAuth, and FullAuth
const BaseAuthSchema = z.object({
  authStatus: z.enum(['none', 'partial', 'full']),
  authMessage: z.string()
});

export const InvalidAuthSchema = BaseAuthSchema.extend({
  authStatus: z.literal('none')
});

export type InvalidAuth = z.infer<typeof InvalidAuthSchema>;

export const PartialAuthSchema = BaseAuthSchema.extend({
  authStatus: z.literal('partial'),
  roles: z.array(z.string()),
  outputs: PluginOutputSchema
});

export type PartialAuth = z.infer<typeof PartialAuthSchema>;

export const FullAuthSchema = BaseAuthSchema.extend({
  authStatus: z.literal('full'),
  roles: z.array(z.string()),
  outputs: PluginOutputSchema
});

export type FullAuth = z.infer<typeof FullAuthSchema>;

export const PluginRolesAuthSchema = z.union([
  InvalidAuthSchema,
  PartialAuthSchema,
  FullAuthSchema
]);

export type PluginRolesAuth = z.infer<typeof PluginRolesAuthSchema>;

export type PluginRoleMap = {
  [pluginName: string]: ((pluginOutput: unknown) => string[]) | string[];
};

export const pluginRolesAuthEncDecoderFp: EncodeDecoder<
  FpInterfaceType,
  PluginRolesAuth
> = {
  __interface_tag: fpInterfaceTag,
  encode: (auth: PluginRolesAuth): unknown => {
    return auth as unknown;
  },
  decode: wrapZodDec(fpInterfaceTag, PluginRolesAuthSchema).decode
};

export const pluginRolesAuthEncDecoderTs: EncodeDecoder<
  TsInterfaceType,
  PluginRolesAuth
> = {
  __interface_tag: tsInterfaceTag,
  encode: (auth: PluginRolesAuth): unknown => {
    return auth as unknown;
  },
  decode: wrapZodDec(tsInterfaceTag, PluginRolesAuthSchema).decode
};

export const pluginAuthReqEncDecoderTs: EncodeDecoder<
  TsInterfaceType,
  PMap<unknown>
> = {
  __interface_tag: tsInterfaceTag,
  encode: (auth: PMap<unknown>): unknown => {
    return auth as unknown;
  },
  decode: wrapZodDec(tsInterfaceTag, PluginInputsSchema).decode
};

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
  implements
    IAuthMapper<
      TsInterfaceType,
      PluginInputs,
      PluginRolesAuth,
      PluginOutputs,
      PluginRolesAuth
    >
{
  readonly __interface_tag: TsInterfaceType = 'ts';

  private pluginHost: IPluginHost<TsInterfaceType>; // Specify the correct InterfaceKind if needed
  private roleMap: Record<string, (pluginOutput: unknown) => string[]>;

  extractValidityCheck(authResponse: PluginRolesAuth): PluginOutputs {
    if (authResponse.authStatus === 'none') {
      return {};
    }
    return authResponse.outputs;
  }

  private constructor(
    pluginHost: IPluginHost<FpInterfaceType> | IPluginHost<TsInterfaceType>,
    roleMap: PluginRoleMap,
    readonly log: Logger
  ) {
    // if pluginhost is of fp interface type, convert it to ts interface type
    if (pluginHost.__interface_tag === fpInterfaceTag) {
      this.pluginHost = fpToTsPluginHost(pluginHost);
    } else {
      this.pluginHost = pluginHost;
    }

    //convert roleMap to a map of functions
    const converted: Record<string, (pluginOutput: unknown) => string[]> = {};
    for (const pluginName in roleMap) {
      const value = roleMap[pluginName];
      if (typeof value === 'function') {
        // If it's already a function, use it directly.
        converted[pluginName] = value;
      } else {
        // If it's an array, wrap it in a function that ignores its input.
        converted[pluginName] = () => value;
      }
    }
    this.roleMap = converted;
  }

  static initialize(
    pluginHost: IPluginHost<FpInterfaceType> | IPluginHost<TsInterfaceType>,
    roleMap: PluginRoleMap,
    log: Logger
  ): PluginToRoleMapper {
    return new PluginToRoleMapper(pluginHost, roleMap, log);
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
    this.log.debug('Requesting authentication with inputs:', inputs);

    const resps: PMap<Either<string, unknown>> =
      await this.pluginHost.verifyProofAndGetOutput(inputs);

    this.log.debug('Received responses from plugins:', resps);

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
      this.log.debug('Processing output from plugin:', pluginName, output);
      const roles = this.roleMap[pluginName](output);
      roles.forEach((role) => acquiredRoles.add(role));
      outputs[pluginName] = { output, roles };
    });

    this.log.debug('Authentication response:', {
      authStatus,
      authMessage,
      roles: Array.from(acquiredRoles),
      outputs
    });

    return {
      authStatus,
      authMessage,
      roles: Array.from(acquiredRoles),
      outputs
    };
  }

  readonly authResponseEncDecoder: EncodeDecoder<
    TsInterfaceType,
    PluginRolesAuth
  > = pluginRolesAuthEncDecoderTs;

  readonly authRequestEncDecoder: EncodeDecoder<TsInterfaceType, PluginInputs> =
    pluginAuthReqEncDecoderTs;

  // TODO: currently is the validation fails for some plugin the auth response will shrink.
  // this might be unexpected behavior. We might just want to return the original auth response
  // but with with information that the output was not considered valid by particular plugins.
  // This would allow to resend the same auth response later if one expect that it'd work now.
  public async checkAuthValidity(
    outputRoleMap: PluginOutputs
  ): Promise<PluginRolesAuth> {
    this.log.debug(
      'Checking authentication validity for outputs:',
      outputRoleMap
    );
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
      roles: Array.from(roles),
      outputs: outputRoleMap
    };
  }
}
