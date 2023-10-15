import { Router } from 'express';
import { JsonProof } from 'o1js';
import z from 'zod';
import { CachedProof, fpToTsCheckCachedProofs } from './proofCache';
import { fromFailablePromise } from '@utils/fp/TaskEither';
import {
  InterfaceKind,
  WithInterfaceTag,
  RetType,
  TsInterfaceType,
  FpInterfaceType
} from '@lib/common/interfaceKind';

// Interfaces used on the server side.

/**
 * MinAuth plugin must implement this interface.
 * The interface type is parameterized by an interface kind:
 * - `TsInterfaceType` for idiomatic typescript interface
 * - `FpInterfaceType` for functional style interface
 * that is usd by the library to provide safety and composability.
 * A plugin author is free to implement the plugin using any interface,
 * the library will convert it to the functional style interface.
 * A plugin is a server-side component that can be used to verify a proof.
 * It may defined custom routes and handlers that are necessary for the
 * client counterpart to generate a proof.
 * The two remainng arguments `PublicInputArgs` and `Output` parametrize
 * The plugin input and output.
 * `PublicInputArgs` usually will define the way to acquire public inputs
 * for the proof and `Output` will wrap the output of the proof.
 */
export interface IMinAuthPlugin<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  /**
   * This is meant to build the public inputs for the proof and verify
   * the proof using compiled verifier zk-circuit.
   */
  verifyAndGetOutput(
    publicInputArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): RetType<InterfaceType, Output>;

  // The schema of the arguments for fetching public inputs.
  readonly publicInputArgsSchema: z.ZodType<PublicInputArgs>;

  // TODO: enable plugins to invalidate a proof.
  // FIXME(Connor): I still have some questions regarding the validation functionality.
  // In particular, what if a plugin want to invalidate the proof once the public inputs change?
  // We have to at least pass PublicInputArgs.
  //
  /**
   * Plugins should be able to confirm the validity produced outputs.
   * Most outputs along with underlying proofs can get outdated by
   * changes to the data that the proof is based on.
   */
  // checkOutputValidity(output: Output): RetType<InterfaceType, OutputValidity>;

  // Custom routes and handlers. Will be installed under `/plugins/<plugin name>`
  readonly customRoutes: Router;
}

/**
 * Information about the validity of a proof.
 * In the future there could be more information that plugin wants to return.
 */
export type OutputValidity = { isValid: boolean; reason?: string };

// TODO: generic type inference?
// TODO question: can you elaborrate

/**
 * A plugin factory is responsible for initializing a plugin given the configuration.
 * A module defining a plugin must export a value of this type as `default`.
 * For the explanation of the interface type parameter, see `IMinAuthPlugin`.
 */
export interface IMinAuthPluginFactory<
  InterfaceType extends InterfaceKind,
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  /**
   * Initialize the plugin given the configuration.
   * The underlying zk program is typically compiled here.
   * @param cfg The plugin configuration
   * @param outputValidityUpdate: a callback that the plugin can use to notify about
   * the validity of outputs it has generated.
   */
  initialize(
    cfg: Configuration,
    checkCacheProofs: (
      check: (p: CachedProof) => RetType<InterfaceType, boolean>
    ) => RetType<InterfaceType, void>
    // TODO plugins are meant to be asked about the validity of a proof
    // additionally they should have a way to inform about validity changes
    // onOutputValidityChange?: (
    //   outputValidityUpdate: [Output, OutputValidity]
    // ) => RetType<InterfaceType, PluginType>
  ): RetType<InterfaceType, PluginType>;

  /**
   * The plugin factory should provide a schema to parse the configuration against.
   */
  readonly configurationSchema: z.ZodType<Configuration>;
}

// ts -> fp

/**
 * Convert a plugin from the idiomatic typescript interface to the functional style
 */
export const tsToFpMinAuthPlugin = <PublicInputArgs, Output>(
  i: IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>
): IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output> => {
  return {
    __interface_tag: 'fp',
    verifyAndGetOutput: (pia, sp) =>
      fromFailablePromise(() => i.verifyAndGetOutput(pia, sp)),
    publicInputArgsSchema: i.publicInputArgsSchema,
    customRoutes: i.customRoutes
    // checkOutputValidity: (o) =>
    //   fromFailablePromise(() => i.checkOutputValidity(o))
  };
};

/**
 * Convert a plugin factory from the idiomatic typescript interface to the functional style
 */
export const tsToFpMinAuthPluginFactory = <
  Configuration,
  PublicInputArgs,
  Output
>(
  i: IMinAuthPluginFactory<
    TsInterfaceType,
    IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>,
    Configuration,
    PublicInputArgs,
    Output
  >
): IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs,
  Output
> => {
  return {
    __interface_tag: 'fp',
    configurationSchema: i.configurationSchema,
    initialize: (cfg, c) =>
      fromFailablePromise(() =>
        i.initialize(cfg, fpToTsCheckCachedProofs(c)).then(tsToFpMinAuthPlugin)
      )
  };
};
