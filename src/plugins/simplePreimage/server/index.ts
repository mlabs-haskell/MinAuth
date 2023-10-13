import { JsonProof } from 'o1js';
import { IMinAuthPlugin, IMinAuthPluginFactory } from '@lib/plugin/pluginType';
import ProvePreimageProgram, {
  ProvePreimageProofClass
} from '../common/hashPreimageProof';
import { RequestHandler } from 'express';
import { z } from 'zod';

const roleMapping: Record<string, string> = {
  '7555220006856562833147743033256142154591945963958408607501861037584894828141':
    'admin',
  '21565680844461314807147611702860246336805372493508489110556896454939225549736':
    'member'
};

export class SimplePreimagePlugin implements IMinAuthPlugin<unknown, string> {
  readonly verificationKey: string;
  private readonly roles: Record<string, string>;

  async verifyAndGetOutput(
    _: unknown,
    serializedProof: JsonProof
  ): Promise<string> {
    const proof = ProvePreimageProofClass.fromJSON(serializedProof);
    const role = roleMapping[proof.publicOutput.toString()];
    return role;
  }

  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  customRoutes: Record<string, RequestHandler> = {
    '/roles': (_, res) => {
      res.status(200).json(this.roles);
    }
  };

  // checkOutputValidity(output: string): Promise<boolean> {
  //     return Promise.resolve(output in this.roles);
  // }

  constructor(verificationKey: string, roles: Record<string, string>) {
    this.verificationKey = verificationKey;
    this.roles = roles;
  }

  static async initialize(configuration: {
    roles: Record<string, string>;
  }): Promise<SimplePreimagePlugin> {
    const { verificationKey } = await ProvePreimageProgram.compile();
    return new SimplePreimagePlugin(verificationKey, configuration.roles);
  }

  static readonly configurationSchema: z.ZodType<{
    roles: Record<string, string>;
  }> = z.object({
    roles: z.record(
      // FIXME: the key should be a valid poseidon hash
      z.string(),
      z.string()
    )
  });
}

// sanity check
SimplePreimagePlugin satisfies IMinAuthPluginFactory<
  SimplePreimagePlugin,
  { roles: Record<string, string> },
  unknown,
  string
>;
