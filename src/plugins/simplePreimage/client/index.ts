import { Field, JsonProof } from 'o1js';
import { IMinAuthProver, IMinAuthProverFactory } from '@lib/plugin';
import ProvePreimageProgram from '../common/hashPreimageProof';
import { TsInterfaceType } from '@lib/plugin/fp/interfaceKind';

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
    await ProvePreimageProgram.compile();
    return new SimplePreimageProver();
  }
}

SimplePreimageProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  SimplePreimageProver,
  unknown
>;
