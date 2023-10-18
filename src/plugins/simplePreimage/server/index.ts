import { JsonProof } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  combineEncDec,
  outputValid,
  wrapTrivialEnc,
  wrapZodDec
} from '@lib/plugin';
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

export class SimplePreimagePlugin
  implements IMinAuthPlugin<TsInterfaceType, unknown, string>
{
  readonly __interface_tag = 'ts';

  readonly verificationKey: string;
  private readonly roles: Record<string, string>;

  async verifyAndGetOutput(
    _: unknown,
    serializedProof: JsonProof
  ): Promise<string> {
    const proof = ProvePreimageProofClass.fromJSON(serializedProof);
    const ret = R.lookup(proof.publicOutput.toString())(this.roles);
    if (O.isNone(ret)) throw 'unable to find role';
    else return ret.value;
  }

  publicInputArgsSchema: z.ZodType<unknown> = z.any();

  readonly customRoutes = Router().get('/roles', (_, res) =>
    res.status(200).json(this.roles)
  );

  async checkOutputValidity(): Promise<OutputValidity> {
    return outputValid;
  }

  constructor(verificationKey: string, roles: Record<string, string>) {
    this.verificationKey = verificationKey;
    this.roles = roles;
  }

  static readonly __interface_tag = 'ts';

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

  static readonly configurationDec = wrapZodDec('ts', configurationSchema);

  static readonly publicInputArgsDec = wrapZodDec('ts', z.unknown());

  static readonly outputEncDec = combineEncDec(
    wrapTrivialEnc('ts'),
    wrapZodDec('ts', z.string())
  );
}

// sanity check
SimplePreimagePlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  SimplePreimagePlugin,
  Configuration
>;

export default SimplePreimagePlugin;
