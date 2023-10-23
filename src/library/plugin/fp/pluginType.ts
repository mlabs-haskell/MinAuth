import { Router } from 'express';
import { JsonProof } from 'o1js';
import {
  InterfaceKind,
  WithInterfaceTag,
  RetType,
  TsInterfaceType,
  FpInterfaceType
} from './interfaceKind';
import { fromFailablePromise } from '@utils/fp/TaskEither';
import {
  Decoder,
  EncodeDecoder,
  combineEncDec,
  tsToFpDecoder,
  tsToFpEncoder
} from './EncodeDecoder';
import * as log from 'tslog';

// Interfaces used on the server side.

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

export type Logger = log.Logger<log.ILogObj>;

export interface IMinAuthPlugin<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  // Verify a proof give the arguments for fetching public inputs, and return
  // the output.
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

  // Custom routes and handlers. Will be installed under `/plugins/<plugin name>`
  readonly customRoutes: Router;

  // The verification key of the underlying zk circuit.
  readonly verificationKey: string;
}

type ExtractPluginPublicInputArgsType<T> = T extends IMinAuthPlugin<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _1,
  infer PublicInputArgs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer _2
>
  ? PublicInputArgs
  : never;

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

export interface IMinAuthPluginFactory<
  InterfaceType extends InterfaceKind,
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs = ExtractPluginPublicInputArgsType<PluginType>,
  Output = ExtractPluginOutputType<PluginType>
> extends WithInterfaceTag<InterfaceType> {
  // Initialize the plugin given the configuration. The underlying zk program is
  // typically compiled here.
  initialize(
    cfg: Configuration,
    logger: Logger
  ): RetType<InterfaceType, PluginType>;

  readonly configurationDec: Decoder<InterfaceType, Configuration>;

  readonly publicInputArgsDec: Decoder<InterfaceType, PublicInputArgs>;

  readonly outputEncDec: EncodeDecoder<InterfaceType, Output>;
}

// Interfaces used on the client side.

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
  initialize(cfg: Configuration): RetType<InterfaceType, ProverType>;
}

// ts -> fp

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
