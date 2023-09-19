import { JsonProof } from "snarkyjs";

export type PluginType = {
  compile: () => Promise<string>;
  getInputs: () => Promise<string[]>;
  verify: (
      jsonProof: JsonProof,
      verificationKey: string,
  ) => Promise<[string | boolean | undefined, string]>;
  prove: (inputs: string[]) => Promise<undefined | JsonProof>;
};