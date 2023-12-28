import { Router } from 'express';
import { JsonProof } from 'o1js';
import {
  InterfaceKind,
  WithInterfaceTag,
  RetType,
  TsInterfaceType,
  FpInterfaceType
} from './interfacekind.js';
import {
  Decoder,
  EncodeDecoder,
  combineEncDec,
  tsToFpDecoder,
  tsToFpEncoder
} from './encodedecoder.js';
import { Logger } from './logger.js';
import { fromFailablePromise } from '../utils/fp/taskeither.js';
import { VerificationKey } from '../common/verificationkey.js';

// Interfaces used on the server side.

/**
 * Information about the validity of a proof.
 * In the future there could be more information that plugin wants to return.
 */
export type OutputValidity =
  | {
      isValid: true;
    }
  | {
      isValid: false;
      reason: string;
    };

export const outputValid: OutputValidity = { isValid: true };

export const outputInvalid = (reason: string): OutputValidity => {
  return {
    isValid: false,
    reason
  };
};

/**
 * MinAuth plugins must implement this interface.
 * The interface type is parameterized by an interface kind:
 * - `TsInterfaceType` for idiomatic typescript interface
 * - `FpInterfaceType` for functional style interface
 * that is used by the library to provide safety and composability.
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

  /**
   * Plugins should be able to confirm the validity produced outputs.
   * Most outputs along with underlying proofs can get outdated by
   * changes to the data that the proof is based on.
   *
   * This function shouldn't error out unless an internal error occurred during
   * validation.
   */
  checkOutputValidity(output: Output): RetType<InterfaceType, OutputValidity>;

  /** Custom routes and handlers. Will be installed under `/plugins/<plugin name>` */
  readonly customRoutes: Router;

  // TODO consider removing this from the interface
  // Plugin will be internally responsible for the zk circuit.

  /** The verification key of the underlying zk circuit. */
  readonly verificationKey: VerificationKey;
}

/** Type parameter extraction (inference) helpers. */
type ExtractPluginPublicInputArgsType<T> = T extends IMinAuthPlugin<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  infer PublicInputArgs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2
>
  ? PublicInputArgs
  : never;

/** Type parameter extraction (inference) helpers. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractPluginOutputType<T> = T extends IMinAuthPlugin<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2,
  infer Output
>
  ? Output
  : never;

/**
 * A plugin factory is responsible for initializing a plugin given the configuration.
 * A module defining a plugin must export a value of this type as `default`.
 * For the explanation of the interface type parameter, see `IMinAuthPlugin`.
 */
export interface IMinAuthPluginFactory<
  InterfaceType extends InterfaceKind,
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs = ExtractPluginPublicInputArgsType<PluginType>,
  Output = ExtractPluginOutputType<PluginType>
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
    logger: Logger
  ): RetType<InterfaceType, PluginType>;

  /** Decoder for the plugin configuration. */
  readonly configurationDec: Decoder<InterfaceType, Configuration>;

  /** Decoder for the public input construction arguments. */
  readonly publicInputArgsDec: Decoder<InterfaceType, PublicInputArgs>;

  /** Encoder/Decoder for the plugins outputs. */
  readonly outputEncDec: EncodeDecoder<InterfaceType, Output>;
}

// Interfaces used on the client side.

/**
 * IMinAuthProver defines the part of MinAuth plugin that is used by the client
 * - the party that wants to present a proof qualifying for access to a resource.
 * The interface type is parameterized by an interface kind:
 * - `TsInterfaceType` for idiomatic typescript interface
 * - `FpInterfaceType` for functional style interface
 * that is usd by the library to provide safety and composability.
 * A plugin author is free to implement the prover using any interface,
 * the library will convert it to the functional style interface for internal use.
 *
 * @param InterfaceType - the interface kind
 * @param PublicInputArgs - used to parameterize the way in which public inputs
 * are prepared for the proof.
 * @param PublicInput - the type of public input needed to produce a proof.
 * @param PrivateInput - the type of private input needed to produce a proof.
 */
export interface IMinAuthProver<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  PublicInput,
  PrivateInput
> extends WithInterfaceTag<InterfaceType> {
  prove(
    publicInput: PublicInput,
    secretInput: PrivateInput
  ): RetType<InterfaceType, JsonProof>;

  fetchPublicInputs(args: PublicInputArgs): RetType<InterfaceType, PublicInput>;
}

type ExtractProverPublicInputArgsType<T> = T extends IMinAuthProver<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  infer PublicInputArgs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _3
>
  ? PublicInputArgs
  : never;

type ExtractProverPublicInputType<T> = T extends IMinAuthProver<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2,
  infer PublicInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _3
>
  ? PublicInput
  : never;

type ExtractProverPrivateInputType<T> = T extends IMinAuthProver<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _3,
  infer PrivateInput
>
  ? PrivateInput
  : never;

/**
 * IMinAuthProverFactory encapsulates the logic of creating a prover.
 * The meaning of its type parameters can be looked up in the documentation
 * of `IMinAuthProver`.
 *
 * @param cfg The plugin configuration
 * @param compile: whether to compile the underlying zk circuit
 * @returns a prover
 */
export interface IMinAuthProverFactory<
  InterfaceType extends InterfaceKind,
  ProverType extends IMinAuthProver<
    InterfaceType,
    PublicInputArgs,
    PublicInput,
    PrivateInput
  >,
  Configuration,
  PublicInputArgs = ExtractProverPublicInputArgsType<ProverType>,
  PublicInput = ExtractProverPublicInputType<ProverType>,
  PrivateInput = ExtractProverPrivateInputType<ProverType>
> extends WithInterfaceTag<InterfaceType> {
  initialize(
    cfg: Configuration,
    { compile }: { compile: boolean }
  ): RetType<InterfaceType, ProverType>;

  compile(): RetType<InterfaceType, { verificationKey: VerificationKey }>;
}

// ts -> fp

/**
 * Convert a plugin factory from the idiomatic typescript interface to the functional style
 */
export const tsToFpMinAuthPlugin = <PublicInputArgs, Output>(
  i: IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>
): IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output> => {
  return {
    __interface_tag: 'fp',
    verifyAndGetOutput: (pia, sp) =>
      fromFailablePromise(() => i.verifyAndGetOutput(pia, sp)),
    checkOutputValidity: (o) =>
      fromFailablePromise(() => i.checkOutputValidity(o)),
    customRoutes: i.customRoutes,
    verificationKey: i.verificationKey
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
    Configuration
  >
): IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output>,
  Configuration
> => {
  return {
    __interface_tag: 'fp',
    configurationDec: tsToFpDecoder(i.configurationDec),
    publicInputArgsDec: tsToFpDecoder(i.publicInputArgsDec),
    outputEncDec: combineEncDec(
      tsToFpEncoder(i.outputEncDec),
      tsToFpDecoder(i.outputEncDec)
    ),
    initialize: (cfg, logger) =>
      fromFailablePromise(() =>
        i.initialize(cfg, logger).then(tsToFpMinAuthPlugin)
      )
  };
};
