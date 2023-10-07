import { Field, JsonProof } from 'o1js';
import {
  IMinAuthProver,
  IMinAuthProverFactory,
  TsInterfaceType
} from '@lib/plugin';
import ProvePreimageProgram from '../common/hashPreimageProof';

export class SimplePreimageProver
  implements IMinAuthProver<TsInterfaceType, unknown, Field, Field>
{
  readonly __interface_tag: 'ts';

  async prove(publicInput: Field, secretInput: Field): Promise<JsonProof> {
    console.debug('proving', publicInput, secretInput);
    const proof = await ProvePreimageProgram.baseCase(publicInput, secretInput);
    return proof.toJSON();
  }

  fetchPublicInputs(): Promise<Field> {
    throw 'not implemented, please query the `/roles` endpoint';
  }

  static readonly __interface_tag: 'ts';

  static async initialize(): Promise<SimplePreimageProver> {
    return new SimplePreimageProver();
  }
}

SimplePreimageProver satisfies IMinAuthProverFactory<
  SimplePreimageProver,
  TsInterfaceType,
  unknown,
  unknown,
  Field,
  Field
>;
