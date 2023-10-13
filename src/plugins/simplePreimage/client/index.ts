import { Field, JsonProof } from 'o1js';
import { IMinAuthProver } from '@lib/plugin/pluginType';
import ProvePreimageProgram from '../common/hashPreimageProof';

export class SimplePreimageProver
  implements IMinAuthProver<unknown, Field, Field>
{
  async prove(publicInput: Field, secretInput: Field): Promise<JsonProof> {
    console.log('simplePreimage proving for', publicInput, secretInput);
    const proof = await ProvePreimageProgram.baseCase(
      Field(publicInput),
      Field(secretInput)
    );
    return proof.toJSON();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchPublicInputs(_: unknown): Promise<Field> {
    throw 'not implemented, please query the `/roles` endpoint';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async initialize(_: unknown): Promise<SimplePreimageProver> {
    return new SimplePreimageProver();
  }
}
