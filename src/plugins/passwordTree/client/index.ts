import { Field, JsonProof } from "o1js";
import ProvePasswordInTreeProgram, { PasswordTreePublicInput, PasswordTreeWitness } from "../common/passwordTreeProgram";
import { IMinAuthProver, IMinAuthProverFactory } from '../../../library/plugin/pluginType';

import axios from "axios";

export type SimplePasswordTreeProverConfiguration = {
  apiServer: URL,
}

export class SimplePasswordTreeProver implements
  IMinAuthProver<bigint, PasswordTreePublicInput, Field>
{
  private readonly cfg: SimplePasswordTreeProverConfiguration;

  async prove(publicInput: PasswordTreePublicInput, secretInput: Field)
    : Promise<JsonProof> {
    const proof = await ProvePasswordInTreeProgram.baseCase(
      publicInput, Field.from(secretInput));
    return proof.toJSON();
  }

  async fetchPublicInputs(uid: bigint): Promise<PasswordTreePublicInput> {
    const mkUrl = (endpoint: string) => `${this.cfg.apiServer}/${endpoint}`;
    const getWitness = async (): Promise<PasswordTreeWitness> => {
      const resp = await axios.get(mkUrl(`/witness/${uid.toString()}`));
      if (resp.status != 200) {
        throw `unable to fetch witness for ${uid.toString()}, error: ${(resp.data as { error: string }).error}`;
      }
      return PasswordTreeWitness.fromJSON(resp.data);
    };
    const getRoot = async (): Promise<Field> => {
      const resp = await axios.get(mkUrl('/root'));
      return Field.fromJSON(resp.data);
    }
    const witness = await getWitness();
    const root = await getRoot();

    return new PasswordTreePublicInput({ witness, root });
  }

  constructor(cfg: SimplePasswordTreeProverConfiguration) {
    this.cfg = cfg;
  }

  static async initialize(cfg: SimplePasswordTreeProverConfiguration):
    Promise<SimplePasswordTreeProver> {
    return new SimplePasswordTreeProver(cfg);
  }
}

SimplePasswordTreeProver satisfies IMinAuthProverFactory<
  SimplePasswordTreeProver,
  SimplePasswordTreeProverConfiguration,
  bigint,
  PasswordTreePublicInput,
  Field
>
