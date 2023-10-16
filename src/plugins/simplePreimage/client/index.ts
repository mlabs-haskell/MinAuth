import { Field, JsonProof } from 'o1js';
import ProvePreimageProgram from '../common/hashPreimageProof';
import { IMinAuthProver, IMinAuthProverFactory } from '@lib/client/prover';
import { TsInterfaceType } from '@lib/common/interfaceKind';

/**
 * Somewhat trivial example of a prover.
 * The server keeps a fixed set of hashes.
 * Each hash is associated with a role in the system.
 * You can prove that you have the role by providing the secret
 * preimage of the hash.
 *
 * NOTE. Although you can always generate valid zkproof its output must
 *       match the list kept by the server.
 */
export class SimplePreimageProver
  implements IMinAuthProver<TsInterfaceType, unknown, Field, Field>
{
  // This prover uses an idiomatic Typescript interface
  readonly __interface_tag: 'ts';
  static readonly __interface_tag: 'ts';

  /**
   * Build a proof.
   */
  async prove(publicInput: Field, secretInput: Field): Promise<JsonProof> {
    console.debug('proving', publicInput, secretInput);
    const proof = await ProvePreimageProgram.baseCase(publicInput, secretInput);
    return proof.toJSON();
  }

  /**
   * Fetches a list of hashes recognized by the server.
   */
  fetchPublicInputs(): Promise<Field> {
    // TODO
    throw 'not implemented, please query the `/roles` endpoint';
  }

  // Initialize the prover
  static async initialize(): Promise<SimplePreimageProver> {
    await ProvePreimageProgram.compile();
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
