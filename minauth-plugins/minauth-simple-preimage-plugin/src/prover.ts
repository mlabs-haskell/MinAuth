import { Field, JsonProof, Cache } from 'o1js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/dist/plugin/plugintype.js';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import ProvePreimageProgram from './hash-preimage-proof.js';
import z from 'zod';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { PluginRouter } from 'minauth/dist/plugin/pluginrouter.js';

const RolesSchema = z.record(z.string().min(1), z.string().min(1));
type Roles = z.infer<typeof RolesSchema>;

export type Configuration = {
  logger: Logger;
  pluginRoutes: PluginRouter;
};

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
  protected readonly logger: Logger;

  /** The prover's plugin routes */
  protected readonly pluginRoutes: PluginRouter;

  protected constructor(logger: Logger, pluginRoutes: PluginRouter) {
    this.logger = logger;
    this.pluginRoutes = pluginRoutes;
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

  async getRoles(): Promise<Roles> {
    return this.pluginRoutes.get('/admin/roles', RolesSchema);
  }

  /** Compile the underlying zk circuit */
  static async compile(): Promise<{ verificationKey: VerificationKey }> {
    // disable cache because of bug in o1js 0.14.1:
    // you have a verification key acquired by using cached circuit AND
    // not build a proof locally,
    // but use a serialized one - it will hang during verification.
    return await ProvePreimageProgram.compile({ cache: Cache.None });
  }

  /** Initialize the prover */
  static async initialize(
    config: Configuration,
    { compile = true } = {}
  ): Promise<SimplePreimageProver> {
    const { logger, pluginRoutes } = config;
    logger.info('SimplePreimageProver.initialize');
    if (compile) {
      logger.info('compiling the circuit');
      await SimplePreimageProver.compile();
      logger.info('compiled');
    }
    return new SimplePreimageProver(logger, pluginRoutes);
  }
}

SimplePreimageProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  SimplePreimageProver,
  unknown
>;

export class DemoSimplePreimageProver extends SimplePreimageProver {
  async setRoles(roles: Roles): Promise<void> {
    return await this.pluginRoutes.post('/admin/roles', RolesSchema, roles);
  }
}
