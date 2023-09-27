import { RequestHandler } from "express";
import { JsonProof } from "o1js";
import z from 'zod';

// Interfaces used on the server side.

export interface IMinAuthPlugin<PublicInputsArgs, Output> {
  // Verify a proof give the arguments for fetching public inputs, and return
  // the output.
  verifyAndGetOutput(
    publicInputArgs: PublicInputsArgs,
    serializedProof: JsonProof): Promise<Output>;

  // The schema of the arguments for fetching public inputs.
  readonly publicInputArgsSchema: z.ZodType<PublicInputsArgs>;

  // TODO: enable plugins to invalidate a proof.
  // FIXME(Connor): I still have some questions regarding the validation functionality.
  // In particular, what if a plugin want to invalidate the proof once the public inputs change?
  // We have to at least pass PublicInputsArgs.
  //
  // checkOutputValidity(output: Output): Promise<boolean>;

  // Custom routes and handlers. Will be installed under `/plugins/<plugin name>`
  readonly customRoutes: Record<string, RequestHandler>;

  // The verification key of the underlying zk circuit.
  readonly verificationKey: string;
}

// TODO: generic type inference?
export interface IMinAuthPluginFactory<
  T extends IMinAuthPlugin<PublicInputsArgs, Output>,
  Configuration, PublicInputsArgs, Output> {

  // Initialize the plugin given the configuration. The underlying zk program is 
  // typically compiled here.
  initialize(cfg: Configuration): Promise<T>;

  readonly configurationSchema: z.ZodType<Configuration>;
}

// Interfaces used on the client side.

export interface IMinAuthProver<PublicInputsArgs, PublicInput, PrivateInput> {
  prove(publicInput: PublicInput, secretInput: PrivateInput): Promise<JsonProof>;

  fetchPublicInputs(args: PublicInputsArgs): Promise<PublicInput>;
}

export interface IMinAuthProverFactory<
  T extends IMinAuthProver<
    PublicInputsArgs,
    PublicInput,
    PrivateInput>,
  Configuration,
  PublicInputsArgs,
  PublicInput,
  PrivateInput> {
  initialize(cfg: Configuration): Promise<T>;
}