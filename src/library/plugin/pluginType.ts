import { json } from "body-parser";
import { PublicKeyInput } from "crypto";
import { RequestHandler } from "express";
import { JsonProof } from "o1js";
import { initialize } from "passport";
import z from 'zod';

export type PluginType = {
  compile: () => Promise<string>;
  getInputs: () => Promise<string[]>;
  verify: (
    jsonProof: JsonProof,
    verificationKey: string,
  ) => Promise<[string | boolean | undefined, string]>;
  prove: (inputs: string[]) => Promise<undefined | JsonProof>;
};

// Interfaces used on the server side.

export interface IMinAuthPlugin<PublicInputsArgs, Output> {
  verifyAndGetOutput(
    publicInputArgs: PublicInputsArgs,
    serializedProof: JsonProof): Promise<Output>;

  readonly publicInputArgsSchema: z.ZodType<PublicInputsArgs>;

  // FIXME(Connor): I still have some questions regarding the validation functionality.
  // In particular, what if a plugin want to invalidate the proof once the public inputs change?
  // We have to at least pass PublicInputsArgs.
  //
  // checkOutputValidity(output: Output): Promise<boolean>;

  readonly customRoutes: Record<string, RequestHandler>;

  readonly verificationKey: string;
}

// TODO: generic type inference?
export interface IMinAuthPluginFactory<
  T extends IMinAuthPlugin<PublicInputsArgs, Output>,
  Configuration, PublicInputsArgs, Output> {

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