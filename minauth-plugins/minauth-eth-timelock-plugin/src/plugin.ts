/**
 * TODO plugin module description
 */
import { Cache, JsonProof, verify, Field, ZkProgram } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid
} from 'minauth/dist/plugin/plugintype.js';
import { Program, TREE_HEIGHT } from './merkle-membership-program.js';
import { Router } from 'express';
import { z } from 'zod';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import * as fs from 'fs/promises';
import {
  wrapZodDec,
  combineEncDec,
  noOpEncoder
} from 'minauth/dist/plugin/encodedecoder.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';

/**
 * The plugin configuration schema.
 * NOTE. This is made public via the plugin's custom routes.
 */
export const ConfigurationSchema = z.object({
  /** Alternatively, the "roles" can be loaded from a file */
  loadRolesFrom: z.string()
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

/**
 * No public input fetching is required for this plugin.
 */
export type PublicInputArgs = unknown;

/**
 * The plugin's output schema.
 */
export const OutputSchema = z.object({ merkleRoot: z.string() });

/**
 * The output of the plugin is the merkle root for which the proof
 * is accepted.
 */
export type Output = z.infer<typeof OutputSchema>;

/**
 * Somewhat trivial example of a plugin.
 * The plugin keeps a fixed set of hashes.
 * Each hash is associated with a role in the system.
 * One can prove that they have the role by providing the secret
 * preimage of the hash.
 *
 * NOTE. Although one can always generate valid zkproof its output must
 *       match the list kept by the server.
 */
export class EthTimelockPlugin
  implements IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>
{
  /**
   * This plugin uses an idiomatic Typescript interface
   */
  readonly __interface_tag = 'ts';

  /**
   *  A memoized zk-circuit verification key
   */
  readonly verificationKey: VerificationKey;

  /** The plugin's logger */
  private readonly logger: Logger;

  /**
   * Verify a proof and return the role.
   */
  async verifyAndGetOutput(
    publicInputsArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): Promise<Output> {
    try {
      // fetch valid commitments from the eth contract
      const { commitments } = await ethContract.fetchEligibleCommitments();
      const merkleTree = new MerkleTree(TREE_HEIGHT, commitments);
      this.logger.info(
        `Fetched ${commitments.length} commitments with merkle root ${merkleTree.root}.`,
        commitments
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

      return { merkleRoot: proof.publicInput.merkleRoot.toString() };
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
   * Provide an endpoint returning a list of roles recognized by the plugin.
   * Additionally, provide an endpoint to update the roles
   * NOTE. the setRoles endpoint should not be used by the client
   * but rather by the plugin admin and that it is not persisted.
   */
  readonly customRoutes = Router()
    .post('/admin/roles', (req, res) => {
      try {
        // Assuming the new roles are sent in the request body
        this.roles = rolesSchema.parse(req.body);
        res.status(200).json({ message: 'Roles updated successfully' });
      } catch (error) {
        // Handle errors, such as invalid input
        res.status(400).json({ message: 'Error updating roles' });
      }
    })
    .get('/admin/roles', (_, res) => res.status(200).json(this.roles));

  /**
   * Check if produced output is still valid. If the roles dictionary was edited
   * it may become invalid. Notice that the proof and output consumer must not
   * allow  output forgery as this will accept forged outputs without verification.
   * To prevent it the plugin could take the reponsibility by having a cache of outputs
   * with unique identifiers.
   */
  async checkOutputValidity(output: Output): Promise<OutputValidity> {
    this.logger.debug('Checking validity of ', output);
    if (!this.roles.hasOwnProperty(output.provedHash)) {
      this.logger.debug('Proved hash no longer exists.');
      return Promise.resolve(outputInvalid('Proved hash is no longer valid.'));
    }
    if (this.roles[output.provedHash] !== output.role) {
      this.logger.debug('Proved hash no longer exists.');
      return Promise.resolve(
        outputInvalid('The role assigned to the hash is no longer valid.')
      );
    }
    return Promise.resolve(outputValid);
  }

  /**
   * This ctor is meant ot be called by the `initialize` function.
   */
  constructor(
    verificationKey: VerificationKey,
    roles: Record<string, string>,
    logger: Logger
  ) {
    this.verificationKey = verificationKey;
    this.roles = roles;
    this.logger = logger;
  }

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
    const roles =
      'roles' in configuration
        ? configuration.roles
        : await fs
            .readFile(configuration.loadRolesFrom, 'utf-8')
            .then(JSON.parse);
    return new EthTimelockPlugin(verificationKey, roles, logger);
  }

  static readonly configurationDec = wrapZodDec('ts', ConfigurationSchema);

  static readonly publicInputArgsDec = wrapZodDec('ts', z.unknown());

  /** output parsing and serialization */
  static readonly outputEncDec = combineEncDec(
    noOpEncoder('ts'),
    wrapZodDec('ts', OutputSchema)
  );
}

// sanity check
EthTimelockPlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  EthTimelockPlugin,
  Configuration
>;

export default EthTimelockPlugin;
