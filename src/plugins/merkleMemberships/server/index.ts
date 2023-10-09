import { Experimental, Field, JsonProof, Poseidon } from "o1js";
import * as O from 'fp-ts/Option';
import z from 'zod';
import { IMinAuthPlugin, IMinAuthPluginFactory }
  from '@lib/plugin/pluginType';
import {
  MinaTreesProvider,
  MinaTreesProviderConfiguration,
  TreesProvider,
  minaTreesProviderConfigurationSchema
} from './treeStorage';
import { RequestHandler } from 'express';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import { pipe } from "fp-ts/lib/function";

const PoseidonHashSchema = z.bigint();

const publicInputArgsSchema = z.array(PoseidonHashSchema);

export type PublicInputArgs =
  z.infer<typeof publicInputArgsSchema>;

export class MerkleMembershipsPlugin
  implements IMinAuthPlugin<PublicInputArgs, Field>{
  readonly verificationKey: string;
  private readonly storageProvider: TreesProvider

  customRoutes: Record<string, RequestHandler> = {
    "/getWitness/:treeRoot/:leafIndex": async (req, resp) => {
      if (req.method != 'GET') {
        resp.status(400);
        return;
      }

      const treeRoot = Field.from(req.params['treeRoot']);
      const leafIndex = BigInt(req.params['leafIndex']);

      const tree = O.toUndefined(await this.storageProvider.getTree(treeRoot));

      if (tree === undefined) {
        resp.status(400).json({
          error: "tree not exists"
        });
        return;
      }

      const witness = O.toUndefined(await tree.getWitness(leafIndex));

      if (witness == undefined) {
        resp.status(400).json({
          error: "leaf not exists"
        });
        return;
      }

      resp.status(200).json({
        witness: witness.toJSON(),
      });
    }
  }

  readonly publicInputArgsSchema = publicInputArgsSchema;

  async verifyAndGetOutput(
    treeRoots: PublicInputArgs,
    serializedProof: JsonProof): Promise<Field> {
    const proof =
      Experimental.ZkProgram
        .Proof(ZkProgram.Program)
        .fromJSON(serializedProof);

    const computeHash = async () => {
      let hash: O.Option<Field> = O.none;

      for (const rawRoot of treeRoots) {
        const root = Field(rawRoot);
        const tree = await this.storageProvider.getTree(root);
        if (O.isNone(tree)) throw "tree not found";
        hash =
          pipe(
            hash,
            O.fold
              (
                () => root,
                (current: Field) => Poseidon.hash([current, root])),
            O.some
          )
      };
      return hash;
    }

    const expectedHash = O.toUndefined(await computeHash());

    if (expectedHash === undefined ||
      expectedHash.equals(proof.publicOutput.recursiveHash).not().toBoolean())
      throw "unexpected recursive hash";

    return expectedHash;
  }

  constructor(verificationKey: string, storageProvider: TreesProvider) {
    this.verificationKey = verificationKey;
    this.storageProvider = storageProvider;
  }

  static async initialize(cfg: MinaTreesProviderConfiguration): Promise<MerkleMembershipsPlugin> {
    const { verificationKey } = await ZkProgram.Program.compile();
    const storage = await MinaTreesProvider.initialize(cfg);
    return new MerkleMembershipsPlugin(verificationKey, storage);
  }

  static readonly configurationSchema = minaTreesProviderConfigurationSchema;
}

MerkleMembershipsPlugin satisfies
  IMinAuthPluginFactory<
    IMinAuthPlugin<PublicInputArgs, Field>,
    MinaTreesProviderConfiguration,
    PublicInputArgs,
    Field>;
