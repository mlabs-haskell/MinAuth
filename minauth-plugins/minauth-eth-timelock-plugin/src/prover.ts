/**
 * This module contains a prover counter-part to the Minauth ERC721 time-lock plugin.
 * It interacts with an Ethereum smart contract pointed by the plugin (the verifier)
 * to obtain public inputs for the zkproof used as the Minauth authorization mean.
 */
import { Field, JsonProof, Cache, CircuitString } from 'o1js';
import * as ZkProgram from './merkle-membership-program.js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/dist/plugin/plugintype.js';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import * as z from 'zod';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { EthContract } from './EthContract.js';

// TODO move to minauth
export class PluginRouter {
  constructor(
    private logger: Logger,
    private baseUrl: string,
    private customRouteMapping?: (s: string) => string
  ) {}

  private async request<T>(
    method: 'GET' | 'POST',
    pluginRoute: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Promise<T> {
    try {
      const url = this.customRouteMapping
        ? this.customRouteMapping(pluginRoute)
        : `${this.baseUrl}${pluginRoute}`;
      this.logger.debug(`Requesting ${method} ${pluginRoute}`);
      const response = await fetch(`${url}`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : null
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const validationResult = schema.safeParse(data);
      if (!validationResult.success) {
        throw new Error('Validation failed');
      }

      return validationResult.data;
    } catch (error) {
      this.logger.error('Error in fetch operation:', error);
      throw error;
    }
  }

  async get<T>(pluginRoute: string, schema: z.ZodType<T>): Promise<T> {
    return this.request('GET', pluginRoute, schema);
  }

  async post<T>(
    pluginRoute: string,
    schema: z.ZodType<T>,
    value: T
  ): Promise<void> {
    this.request('POST', pluginRoute, schema, value);
  }
}

/**
 * Configuration for the prover.
 */
export type EthTimelockProverConfiguration = {
  pluginRoutes: PluginRouter;
  ethereumProvider: string;
  logger: Logger;
};

/**
 * The part of the proof inputs that can be automatically fetched.
 * NOTE: The Merkle tree root is the only public information that the proof will reveal.
 */
type ProofAutoInput = {
  merkleRoot: Field;
  treeWitness: ZkProgram.TreeWitness;
};

/**
 * This is the hash that corresponds to the secret preimage.
 * It will not be revealed by the proof nor send anywhere.
 *
 * TODO: this is a symptopm of a bad design of the prover interface,
 *       to be addressed later.
 */
export type EthTimelockProverPublicInputArgs = {
  hash: Field;
};

/**
 * With this class you can build proofs and interact with `EthTimelockPlugin`.
 * The plugin monitors the state of an Ethereum contract.
 * The Ethereum contract implements an NFT timelock scheme.
 * One can lock an NFT for a given period of time along with a hash.
 * All the hashes behind the locked NFTs are stored in a merkle tree.
 * The plugin allows one to prove that they have the preimage of the hash
 * and thus have the right to get the authorization.
 * When use against suffiently large merkle tree provides a level
 * of privacy - the proof does not reveal which hash nor the merkle witness
 * for the hash.
 * Some care must be taken to avoid timing attacks.
 */
export class EthTimelockProver
  implements
    IMinAuthProver<
      TsInterfaceType,
      EthTimelockProverPublicInputArgs,
      ProofAutoInput,
      CircuitString
    >
{
  /** This class uses the functionl style interface of the plugin. */
  readonly __interface_tag = 'ts';

  /**
   * Build a proof for given inputs.
   * Note that even though TreeWitness is passed as public input, it should not be known to the verifier.
   * TODO fix the above
   */
  async prove(
    autoInput: ProofAutoInput,
    secretPreimage: CircuitString
  ): Promise<JsonProof> {
    this.logger.debug('Building proof started.');
    const publicInput = new ZkProgram.PublicInput({
      merkleRoot: autoInput.merkleRoot
    });

    const secretInput = new ZkProgram.PrivateInput({
      witness: autoInput.treeWitness,
      secret: secretPreimage
    });

    const proof = await ZkProgram.Program.proveMembership(
      publicInput,
      secretInput
    );
    this.logger.debug('Building proof finished.');
    return proof.toJSON();
  }

  async buildInputAndProve(secretPreimageString: string) {
    let secretPreimage = null;
    try {
      secretPreimage = CircuitString.fromString(secretPreimageString);
    } catch (e) {
      throw new Error('Could not encode secret preimage');
    }

    const hash = secretPreimage.hash();

    const autoInput = await this.fetchPublicInputs({ hash });

    return await this.prove(autoInput, secretPreimage);
  }

  /**
   * Fetch the data necessary to build the proof inputs.
   * In this case these are Merkle trees related to the roots
   * passed as arguments.
   */
  async fetchPublicInputs(
    args: EthTimelockProverPublicInputArgs
  ): Promise<ProofAutoInput> {
    const commitmentTree = await this.ethContract.buildCommitmentTree();
    const witness = commitmentTree.getWitness(args.hash);

    return {
      merkleRoot: commitmentTree.root,
      treeWitness: witness
    };
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly ethContract: EthContract,
    protected readonly pluginRoutes: PluginRouter
  ) {}

  static readonly __interface_tag = 'ts';

  /** Compile the underlying zk circuit */
  static async compile(): Promise<{ verificationKey: VerificationKey }> {
    // disable cache because of bug in o1js 0.14.1:
    // you have a verification key acquired by using cached circuit AND
    // not build a proof locally,
    // but use a serialized one - it will hang during verification.
    return await ZkProgram.Program.compile({ cache: Cache.None });
  }

  /** Initialize the prover */
  static async initialize(
    cfg: EthTimelockProverConfiguration,
    { compile = true } = {}
  ): Promise<EthTimelockProver> {
    const { logger, pluginRoutes } = cfg;
    logger.info('EthTimelockPlugin.initialize');
    if (compile) {
      logger.info('compiling the circuit');
      await EthTimelockProver.compile();
      logger.info('compiled');
    }

    const ethAddress = await pluginRoutes.get('/contract-address', z.string());

    const ethContract = EthContract.initialize(
      ethAddress,
      cfg.ethereumProvider
    );
    return new EthTimelockProver(logger, ethContract, pluginRoutes);
  }
}

EthTimelockProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  EthTimelockProver,
  EthTimelockProverConfiguration
>;

export default EthTimelockProver;
