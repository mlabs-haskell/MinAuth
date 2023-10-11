import { RequestHandler } from 'express';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { JsonProof } from 'o1js';
import z from 'zod';
import { CachedProof } from './proofCache';

// Interfaces used on the server side.

export type InterfaceKind = FpInterfaceType | TsInterfaceType;

export type FpInterfaceType = 'fp';
export const fpInterfaceTag: FpInterfaceType = 'fp';

export type TsInterfaceType = 'ts';
export const tsInterfaceTag: TsInterfaceType = 'ts';

export type ChooseType<
  InterfaceType extends InterfaceKind,
  FpType,
  TsType
> = InterfaceType extends FpInterfaceType
  ? FpType
  : InterfaceType extends TsInterfaceType
  ? TsType
  : never;

export type RetType<InterfaceType extends InterfaceKind, T> = ChooseType<
  InterfaceType,
  TaskEither<string, T>,
  Promise<T>
>;

export interface WithInterfaceTag<IType extends InterfaceKind> {
  readonly __interface_tag: IType;
}

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
  readonly customRoutes: Record<string, RequestHandler>;

  // The verification key of the underlying zk circuit.
  readonly verificationKey: string;
}

// TODO: generic type inference?
export interface IMinAuthPluginFactory<
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  InterfaceType extends InterfaceKind,
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
