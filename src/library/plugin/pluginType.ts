import { json } from "body-parser";
import { PublicKeyInput } from "crypto";
import { RequestHandler } from "express";
import { JsonProof } from "o1js";
import { initialize } from "passport";

export type PluginType = {
  compile: () => Promise<string>;
  getInputs: () => Promise<string[]>;
  verify: (
    jsonProof: JsonProof,
    verificationKey: string,
  ) => Promise<[string | boolean | undefined, string]>;
  prove: (inputs: string[]) => Promise<undefined | JsonProof>;
};

export interface IMinAuthPlugin<PublicInputsArgs, Output> {
  verifyAndGetOutput(
    publicInputArgs: PublicInputsArgs,
    serializedProof: JsonProof): Promise<undefined | Output>;


  checkOutputValidity(output: Output): Promise<boolean>;

  readonly customRoutes: Map<string, RequestHandler>;

  readonly verificationKey: string;
}

export interface IMinAuthPluginFactory<
  T extends IMinAuthPlugin<PublicInputsArgs, Output>,
  Configuration, PublicInputsArgs, Output> {
  initialize(cfg: Configuration): Promise<T>;
}

export abstract class MinAuthPlugin<Configuration, PublicInputsArgs, Output> {
  abstract initialize(configuration: Configuration): Promise<string/*The verification key*/>;

  abstract verifyAndGetOutput(
    publicInputArgs: PublicInputsArgs,
    serializedProof: JsonProof): Promise<undefined | Output>;

  abstract readonly customRoutes: Map<string, RequestHandler>;
}

export abstract class MinAuthProver<Configuration, PublicInputsArgs, PublicInput, PrivateInput> {
  abstract initialize(configuration: Configuration): Promise<void>;

  abstract prove(publicInput: PublicInput, secretInput: PrivateInput):
    Promise<undefined | JsonProof>;

  abstract fetchPublicInputs(args: PublicInputsArgs): Promise<PublicInput>;
}


export function mkUntypedPlugin<
  T extends IMinAuthPlugin<PublicInputsArgs, Output>,
  Configuration, PublicInputsArgs, Output>(
    type: IMinAuthPluginFactory<T, Configuration, PublicInputsArgs, Output>,
  ): // Oh please let me use haskell
  ((_: any) => Promise<IMinAuthPlugin<any, any>>) {
  return async (cfg: any): Promise<IMinAuthPlugin<any, any>> => {
    const obj = await type.initialize(cfg as Configuration);

    return {
      verifyAndGetOutput: async (
        publicInputArgs: string,
        serializedProof: JsonProof): Promise<undefined | any> =>
        await obj.verifyAndGetOutput(publicInputArgs as PublicInputsArgs, serializedProof),
      checkOutputValidity: async (output: any): Promise<boolean> =>
        await obj.checkOutputValidity(output),
      customRoutes: obj.customRoutes,
      verificationKey: obj.verificationKey
    };
  };
}
