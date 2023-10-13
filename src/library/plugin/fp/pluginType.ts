import { Router } from 'express';
import { JsonProof } from 'o1js';
import z from 'zod';
import { CachedProof, fpToTsCheckCachedProofs } from './proofCache';
import {
  InterfaceKind,
  WithInterfaceTag,
  RetType,
  TsInterfaceType,
  FpInterfaceType
} from './interfaceKind';
import { fromFailablePromise } from '@utils/fp/TaskEither';

// Interfaces used on the server side.

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

  // The schema of the arguments for fetching public inputs.
  readonly publicInputArgsSchema: z.ZodType<PublicInputArgs>;

  // TODO: enable plugins to invalidate a proof.
  // FIXME(Connor): I still have some questions regarding the validation functionality.
  // In particular, what if a plugin want to invalidate the proof once the public inputs change?
  // We have to at least pass PublicInputArgs.
  //
  // checkOutputValidity(output: Output): Promise<boolean>;

  // Custom routes and handlers. Will be installed under `/plugins/<plugin name>`
  readonly customRoutes: Router;

  // The verification key of the underlying zk circuit.
  readonly verificationKey: string;
}

// TODO: generic type inference?
export interface IMinAuthPluginFactory<
  InterfaceType extends InterfaceKind,
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  // Initialize the plugin given the configuration. The underlying zk program is
  // typically compiled here.
  initialize(
    cfg: Configuration,
    checkCacheProofs: (
      check: (p: CachedProof) => RetType<InterfaceType, boolean>
    ) => RetType<InterfaceType, void>
  ): RetType<InterfaceType, PluginType>;

  readonly configurationSchema: z.ZodType<Configuration>;
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

export interface IMinAuthProverFactory<
  ProverType extends IMinAuthProver<
    InterfaceType,
    PublicInputArgs,
    PublicInput,
    PrivateInput
  >,
  InterfaceType extends InterfaceKind,
  Configuration,
  PublicInputArgs,
  PublicInput,
  PrivateInput
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
    publicInputArgsSchema: i.publicInputArgsSchema,
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
