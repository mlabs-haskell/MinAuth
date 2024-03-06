import { Field, JsonProof, Cache } from 'o1js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/dist/plugin/plugintype.js';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { PluginRouter } from 'minauth/dist/plugin/pluginrouter.js';


export type Configuration = {
  logger: Logger;
  pluginRoutes: PluginRouter;
};

/** TODO
 * The plugin allows to use zk cryptographically secure proofs of claims
 * on the zk-documents to be used as a source of authentication.
 * See README.md for more details.
*/
export class ZkDocumentClaimsProver
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
    this.logger.warn('TODO no proof');
    return undefined as unknown as JsonProof;
  }

  /** Fetches a list of hashes recognized by the server. */
  fetchPublicInputs(): Promise<Field> {
    throw 'not implemented, please query the `/roles` endpoint';
  }

  /** Compile the underlying zk circuit */
  static async compile(): Promise<{ verificationKey: VerificationKey }> {
    // TODO check if still the case?
    // disable cache because of bug in o1js 0.14.1:
    // you have a verification key acquired by using cached circuit AND
    // not build a proof locally,
    // but use a serialized one - it will hang during verification.
    return undefined as unknown as { verificationKey: VerificationKey };
  }

  /** Initialize the prover */
  static async initialize(
    config: Configuration,
    { compile = true } = {}
  ): Promise<ZkDocumentClaimsProver> {
    const { logger, pluginRoutes } = config;
    logger.info('ZkDocumentClaimsProver.initialize');
    if (compile) {
      logger.info('compiling the circuit');
      await ZkDocumentClaimsProver.compile();
      logger.info('compiled');
    }
    return new ZkDocumentClaimsProver(logger, pluginRoutes);
  }
}

ZkDocumentClaimsProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  ZkDocumentClaimsProver,
  unknown
>;
