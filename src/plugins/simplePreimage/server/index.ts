import { JsonProof } from 'o1js';
import { IMinAuthPlugin, IMinAuthPluginFactory } from '@lib/plugin';
import ProvePreimageProgram, {
  ProvePreimageProofClass
} from '../common/hashPreimageProof';
import { Router } from 'express';
import { z } from 'zod';
import * as R from 'fp-ts/Record';
import * as O from 'fp-ts/Option';
import { TsInterfaceType } from '@lib/plugin/fp/interfaceKind';
import * as fs from 'fs/promises';

const configurationSchema = z
  .object({
    roles: z.record(
      // FIXME: the key should be a valid poseidon hash
      z.string(),
      z.string()
    )
  })
  .or(
    z.object({
      loadRolesFrom: z.string()
    })
  );

type Configuration = z.infer<typeof configurationSchema>;

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
export class SimplePreimagePlugin
  implements IMinAuthPlugin<TsInterfaceType, unknown, string>
{
  // This plugin uses an idiomatic Typescript interface
  readonly __interface_tag = 'ts';
  static readonly __interface_tag = 'ts';

  /**
   *  A memoized zk-circuit verification key
   */
  readonly verificationKey: string;

  /**
   *  The mapping between hashes and role
   */
  private readonly roles: Record<string, string>;

  /**
   * Verify a proof and return the role.
   */
  async verifyAndGetOutput(
    _: unknown,
    serializedProof: JsonProof
  ): Promise<string> {
    const proof = ProvePreimageProofClass.fromJSON(serializedProof);

    // TODO actually call verify..
    const ret = R.lookup(proof.publicOutput.toString())(this.roles);
    if (O.isNone(ret)) throw 'unable to find role';
    else return ret.value;
  }

  /**
   * Trivial - no public inputs.
   */
  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  /**
   * Provide an endpoint returning a list of roles recognized by the plugin.
   */
  readonly customRoutes = Router().get('/roles', (_, res) =>
    res.status(200).json(this.roles)
  );

  /**
   * This ctor is meant ot be called by the `initialize` function.
   */
  private constructor(verificationKey: string, roles: Record<string, string>) {
    this.verificationKey = verificationKey;
    this.roles = roles;
  }

  static readonly __interface_tag = 'ts';

   /**
   * Initialize the plugin with a configuration.
   */
  static async initialize(
    configuration: Configuration
  ): Promise<SimplePreimagePlugin> {
    const { verificationKey } = await ProvePreimageProgram.compile();
    const roles =
      'roles' in configuration
        ? configuration.roles
        : await fs
            .readFile(configuration.loadRolesFrom, 'utf-8')
            .then(JSON.parse);
    return new SimplePreimagePlugin(verificationKey, roles);
  }

    /**
   * The plugin configuration schema for
   */
  static readonly configurationSchema: z.ZodType<Configuration> =
    configurationSchema;
}

SimplePreimagePlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  SimplePreimagePlugin,
  Configuration,
  unknown,
  string
>;

export default SimplePreimagePlugin;
