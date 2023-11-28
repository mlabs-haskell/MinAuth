import { Field, JsonProof, Cache } from 'o1js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/plugin/plugintype';
import { TsInterfaceType } from 'minauth/plugin/interfacekind';
import { Logger } from 'minauth/plugin/logger';
import ProvePreimageProgram from './hash-preimage-proof';

/**
 * Somewhat trivial example of a prover.
 * The server keeps a fixed set of hashes.
 * Each hash is associated with a role in the system.
 * You can prove that you have the role by providing the secret
 * preimage of the hash.
 *
 * NOTE. Although you can always generate valid zkproof, its output must
 *       match the list kept by the server.
 */
export class SimplePreimageProver
  implements IMinAuthProver<TsInterfaceType, unknown, Field, Field>
{
  /** This prover uses an idiomatic Typescript interface */
  readonly __interface_tag: 'ts';
  static readonly __interface_tag: 'ts';

  /** The prover's logger */
  private readonly logger: Logger;

  private constructor(logger: Logger) {
    this.logger = logger;
  }

  /** Build a proof. */
  async prove(publicInput: Field, secretInput: Field): Promise<JsonProof> {
    this.logger.debug('Building proof started.');
    const proof = await ProvePreimageProgram.baseCase(publicInput, secretInput);
    this.logger.debug('Building proof finished.');
    return proof.toJSON();
  }

  /** Fetches a list of hashes recognized by the server. */
  fetchPublicInputs(): Promise<Field> {
    throw 'not implemented, please query the `/roles` endpoint';
  }

  static async compile(): Promise<{ verificationKey: string }> {
    return await ProvePreimageProgram.compile({ cache: Cache.None });
  }

  /** Initialize the prover */
  static async initialize(logger: Logger): Promise<SimplePreimageProver> {
    return new SimplePreimageProver(logger);
  }
}

SimplePreimageProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  SimplePreimageProver,
  unknown
>;
