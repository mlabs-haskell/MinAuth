/**
 * This module contains an example of a plugin for the minauth library
 * that interacts with an Ethereum smart contract indirectly via a
 * ethers.js client. See the plugin's class documentation for more details.
 */
import crypto from 'crypto';
import { Cache, Field, JsonProof, verify, ZkProgram } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid
} from 'minauth/dist/plugin/plugintype.js';
import { Program } from './merkle-membership-program.js';
import { Router } from 'express';
import { z } from 'zod';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import {
  wrapZodDec,
  combineEncDec,
  noOpEncoder
} from 'minauth/dist/plugin/encodedecoder.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { EthContract } from './EthContract.js';

/**
 * The plugin configuration schema.
 */
export const ConfigurationSchema = z.object({
  ethereumContractAddress: z.string(),
  ethereumProvider: z.string()
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

/**
 * For simplicity sake we don't use additional public inputs arguments.
 * One could for example pick a contract here (from predefined set).
 */
export type PublicInputArgs = unknown;

/**
 * The plugin's output schema.
 */
export const OutputSchema = z.object({
  merkleRoot: z.string(),
  contractConfigurationHash: z.string()
});

/**
 * The output of the plugin is the merkle root for which the proof
 * is accepted and the hash of the configuration used to verify the proof.
 */
export type Output = z.infer<typeof OutputSchema>;

/**
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
export class EthTimelockPlugin
  implements IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>
{
  /**
   * This plugin uses an idiomatic Typescript interface
   */
  readonly __interface_tag = 'ts';

  /**
   * A utility function that hashes (SHA256) the current configuration.
   */
  readonly configurationHash = () => {
    const contractConfigurationHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.configuration))
      .digest('hex');
    return contractConfigurationHash;
  };

  /**
   * Verify a proof and return the role.
   */
  async verifyAndGetOutput(
    _publicInputsArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): Promise<Output> {
    try {
      // fetch valid commitments from the eth contract
      const merkleTree = await this.ethContract.buildCommitmentTree();
      this.logger.info(
        `Fetched ${merkleTree.leafCount} commitments with merkle root ${merkleTree.root}.`
      );
      const proof = ZkProgram.Proof(Program).fromJSON(serializedProof);

      // the proof was generated for another merkle root
      if (proof.publicInput.merkleRoot !== merkleTree.root) {
        const msg =
          'Invalid merkle root. ${proof.publicInput.merkleRoot} !== ${merkleTree.root}';
        this.logger.info(msg);
        throw new Error(msg);
      }

      this.logger.info('ZK Proof verification...');
      const valid = await verify(proof, this.verificationKey.data);
      if (!valid) {
        this.logger.info('Proof verification failed.');
        throw new Error('Invalid proof!');
      }
      // The proof is valid which means that the prover has the knowledge of the
      // preimage of one of the hashes stored in Eth contract.
      this.logger.info('Proof verification succeeded.');

      // hash the configuration and pin it to the output

      return {
        merkleRoot: proof.publicInput.merkleRoot.toString(),
        contractConfigurationHash: this.configurationHash()
      };
    } catch (error) {
      this.logger.error('Error verifying proof: ', error);
      throw error;
    }
  }

  /**
   * Trivial - no public inputs.
   */
  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  /**
   * The plugin exposes a single endpoint that
   * returns the ethereum ERC721 time-lock contract address.
   * The prover should directly interact with the contract to build the proof.
   */
  readonly customRoutes = Router().get('/contract-address', async (_, res) => {
    res.send(this.ethContract.contractAddress);
  });

  /**
   * Check if produced output is still valid.
   * It DOES NOT verify the proof.
   * It assumes that the output was produced by the plugin.
   * So use it only to check if produced output is still valid.
   * Not to re-verifiy the proof.
   * In case of this plugin it means that the merkle tree has not changed.
   */
  async checkOutputValidity(output: Output): Promise<OutputValidity> {
    this.logger.debug('Checking validity of ', output);
    let outputRoot = Field.from(0);
    try {
      outputRoot = Field.from(output.merkleRoot);
    } catch (error) {
      return outputInvalid('Invalid merkle root.');
    }
    const tree = await this.ethContract.buildCommitmentTree();
    if (tree.root !== outputRoot) {
      return outputInvalid('Merkle root has changed.');
    }
    if (this.configurationHash() !== output.contractConfigurationHash) {
      return outputInvalid('Configuration has changed.');
    }
    return Promise.resolve(outputValid);
  }

  /**
   * This ctor is meant to be called by the `initialize` function.
   */
  constructor(
    private readonly ethContract: EthContract,
    readonly verificationKey: VerificationKey,
    readonly configuration: Configuration,
    private readonly logger: Logger
  ) {}

  static readonly __interface_tag = 'ts';

  /**
   * Initialize the plugin with a configuration.
   */
  static async initialize(
    configuration: Configuration,
    logger: Logger
  ): Promise<EthTimelockPlugin> {
    const { verificationKey } = await Program.compile({
      cache: Cache.None
    });
    const ethContract = EthContract.initialize(
      configuration.ethereumContractAddress,
      configuration.ethereumProvider
    );
    return new EthTimelockPlugin(
      ethContract,
      verificationKey,
      configuration,
      logger
    );
  }

  static readonly configurationDec = wrapZodDec('ts', ConfigurationSchema);

  static readonly publicInputArgsDec = wrapZodDec('ts', z.unknown());

  /** output parsing and serialization */
  static readonly outputEncDec = combineEncDec(
    noOpEncoder('ts'),
    wrapZodDec('ts', OutputSchema)
  );
}

// verify the factory interface implementation
EthTimelockPlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  EthTimelockPlugin,
  Configuration
>;

export default EthTimelockPlugin;
