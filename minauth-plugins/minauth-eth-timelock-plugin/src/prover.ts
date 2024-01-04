/**
 * This module contains a prover counter-part to the Minauth ERC721 time-lock plugin.
 * It interacts with an Ethereum smart contract pointed by the plugin (the verifier)
 * to obtain public inputs for the zkproof used as the Minauth authorization mean.
 */
import { Field, JsonProof, Cache } from 'o1js';
import * as ZkProgram from './merkle-membership-program.js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/dist/plugin/plugintype.js';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import * as z from 'zod';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { Erc721TimeLock, IErc721TimeLock } from './erc721timelock.js';
import { BrowserProvider, JsonRpcProvider } from 'ethers';
import {
  UserCommitmentHex,
  UserSecretInput,
  commitmentHexToField,
  mkUserSecret,
  userCommitmentHex
} from './common.js';

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
export type Erc721TimelockProverConfiguration = {
  pluginRoutes: PluginRouter;
  ethereumProvider: BrowserProvider | JsonRpcProvider;
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
export type Erc721TimelockProverPublicInputArgs = {
  userCommitment: UserCommitmentHex;
};

/**
 * With this class you can build proofs and interact with `Erc721TimelockPlugin`.
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
export class Erc721TimelockProver
  implements
    IMinAuthProver<
      TsInterfaceType,
      Erc721TimelockProverPublicInputArgs,
      ProofAutoInput,
      UserSecretInput
    >
{
  /** This class uses the functionl style interface of the plugin. */
  readonly __interface_tag = 'ts';

  /**
   * Build a proof for given inputs.
   * In order to obtain the secret hash use `buildSecretHash` from a secret user string.
   * NOTE that even though TreeWitness is passed as public input, it should not be known to the verifier.
   * TODO fix the above
   */
  async prove(
    autoInput: ProofAutoInput,
    userSecretInput: UserSecretInput
  ): Promise<JsonProof> {
    this.logger.debug('Building proof started.');
    const publicInput = new ZkProgram.PublicInput({
      merkleRoot: autoInput.merkleRoot
    });

    const secretInput = new ZkProgram.PrivateInput({
      witness: autoInput.treeWitness,
      secret: mkUserSecret(userSecretInput).secretHash
    });

    const proof = await ZkProgram.Program.proveMembership(
      publicInput,
      secretInput
    );
    this.logger.debug('Building proof finished.');
    return proof.toJSON();
  }

  async buildInputAndProve(userSecretInput: UserSecretInput) {
    let secretPreimage = null;
    try {
      secretPreimage = mkUserSecret(userSecretInput);
    } catch (e) {
      throw new Error('Could not encode secret preimage');
    }

    const userCommitment = userCommitmentHex(secretPreimage);

    const autoInput = await this.fetchPublicInputs({ userCommitment });

    return await this.prove(autoInput, userSecretInput);
  }

  /**
   * Fetch the data necessary to build the proof inputs.
   * In this case these are Merkle trees related to the roots
   * passed as arguments.
   */
  async fetchPublicInputs(
    args: Erc721TimelockProverPublicInputArgs
  ): Promise<ProofAutoInput> {
    const commitmentTree = await this.ethContract.buildCommitmentTree();
    const commitmentField = commitmentHexToField(args.userCommitment);
    const witness = commitmentTree.getWitness(commitmentField.commitment);

    return {
      merkleRoot: commitmentTree.root,
      treeWitness: witness
    };
  }

  constructor(
    protected readonly logger: Logger,
    protected readonly ethContract: IErc721TimeLock
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
    cfg: Erc721TimelockProverConfiguration,
    { compile = true } = {}
  ): Promise<Erc721TimelockProver> {
    const { logger, pluginRoutes } = cfg;
    logger.info('Erc721TimelockPlugin.initialize');
    if (compile) {
      logger.info('compiling the circuit');
      await Erc721TimelockProver.compile();
      logger.info('compiled');
    }

    const lockContractAddress = await pluginRoutes.get(
      '/timelock-address',
      z.string()
    );
    const nftContractAddress = await pluginRoutes.get(
      '/erc721-address',
      z.string()
    );

    const ethContract = await Erc721TimeLock.initialize(
      { lockContractAddress, nftContractAddress },
      cfg.ethereumProvider
    );
    return new Erc721TimelockProver(logger, ethContract);
  }
}

Erc721TimelockProver satisfies IMinAuthProverFactory<
  TsInterfaceType,
  Erc721TimelockProver,
  Erc721TimelockProverConfiguration
>;

export default Erc721TimelockProver;
