import { Experimental, Field, JsonProof, Poseidon } from "o1js";
import O from 'fp-ts/Option';
import MerkleMembershipsProgram from "../common/merkleMembershipsProgram";
import z from 'zod';
import { IMinAuthPlugin, IMinAuthPluginFactory } from "library/plugin/pluginType";
import { MinaTreesProvider, MinaTreesProviderConfiguration, TreesProvider, minaTreesProviderConfigurationSchema } from "./treeStorage";
import { RequestHandler } from "express";
import A from 'fp-ts/Array';

const PoseidonHashSchema = z.bigint();

const publicInputArgsSchema = z.array(PoseidonHashSchema);

export type MerkleMembershipsPublicInputArgs =
  z.infer<typeof publicInputArgsSchema>;

export class MerkleMembershipsPlugin
  implements IMinAuthPlugin<MerkleMembershipsPublicInputArgs, Field>{
  readonly verificationKey: string;
  private readonly storageProvider: TreesProvider

  customRoutes: Record<string, RequestHandler> = {
    "/getRootAndWitness/:treeIndex/:leafIndex": async (req, resp) => {
      if (req.method != 'GET') {
        resp.status(400);
        return;
      }

      const treeIndex = Number(req.params['treeIndex']);
      const leafIndex = Number(req.params['leafIndex']);

      const trees = await this.storageProvider.getTrees()


      if (treeIndex >= trees.length) {
        resp.status(400).json({
          error: "tree not exists"
        });
        return;
      }

      const tree = trees[treeIndex];

      const root = await tree.getRoot();
      const witness = O.toUndefined(await tree.getWitness(BigInt(leafIndex)));


      if (witness == undefined) {
        resp.status(400).json({
          error: "leaf not exists"
        });
        return;
      }

      resp.status(200).json({
        root: root.toJSON(), 
        witness: witness.toJSON(),
      });

    }
  }

  readonly publicInputArgsSchema = publicInputArgsSchema;

  async verifyAndGetOutput(
    publicInputArgs: MerkleMembershipsPublicInputArgs,
    serializedProof: JsonProof): Promise<Field> {
    const proof =
      Experimental.ZkProgram
        .Proof(MerkleMembershipsProgram)
        .fromJSON(serializedProof);

    const trees = await this.storageProvider.getTrees();

    const expectedHash = O.toUndefined(await
      A.reduce(
        Promise.resolve<O.Option<Field>>(O.none),
        (accP: Promise<O.Option<Field>>, idx: bigint) =>
          accP.then((acc: O.Option<Field>) =>
            trees[Number(idx)]
              .getRoot()
              .then(
                (root) =>
                  Promise.resolve(
                    O.some(
                      O.match(
                        () => root,
                        (last: Field) => Poseidon.hash([root, last])
                      )(acc)))
              )
          )
      )(publicInputArgs));

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
    const { verificationKey } = await MerkleMembershipsProgram.compile();
    const storage = await MinaTreesProvider.initialize(cfg);
    return new MerkleMembershipsPlugin(verificationKey, storage);
  }

  static readonly configurationSchema = minaTreesProviderConfigurationSchema;
}

//   customRoutes: Record<string, RequestHandler> = {
//       // NOTE: witnesses are not public inputs now
//     // "/witness/:uid": async (req, resp) => {
//     //   if (req.method != 'GET') {
//     //     resp.status(400);
//     //     return;
//     //   }

//     //   const uid = BigInt(req.params['uid']);
//     //   const witness = await this.storage.getWitness(uid);

//     //   if (!witness) {
//     //     resp
//     //       .status(400)
//     //       .json({ error: "requested user doesn't exist" });
//     //     return;
//     //   }

//     //   resp.status(200).json(witness);
//     // },

//       // TODO:
//       // input: array of merkle roots (eg. [root1, root2, root3])
//       // output: object of the form { root1: tree1, root2: tree2, root3: tree3 }
//     "/roots": async (req, resp) => {
//       if (req.method != 'GET') {
//         resp.status(400);
//         return;
//       }

//       const root = await this.storage.getRoot();
//       return resp.status(200).json(root);
//     },
//     "/setPassword/:uid": async (req, resp) => {
//       const uid = BigInt(req.params['uid']);
//       const { passwordHashStr }: { passwordHashStr: string } = req.body;
//       const passwordHash = Field.from(passwordHashStr);
//       if (!await this.storage.hasUser(uid))
//         throw "user doesn't exist";
//       const role = await this.storage.getRole(uid);
//       this.storage.updateUser(uid, passwordHash, role!);
//       resp.status(200);
//     }
//   };

//   publicInputArgsSchema = publicInputArgsSchema;

//     async verifyAndGetOutput(uid: z.infer<typeof publicInputArgsSchema>, jsonProof: JsonProof):
//     Promise<string> {

//         // build an array of merkle trees
//     const proof = PasswordInTreeProofClass.fromJSON(jsonProof);
//     const expectedWitness = await this.storage.getWitness(uid);
//     const expectedRoot = await this.storage.getRoot();
//     if (proof.publicInput.witness != expectedWitness ||
//       proof.publicInput.root != expectedRoot) {
//       throw 'public input invalid';
//     }
//     const role = await this.storage.getRole(uid);
//     if (!role) { throw 'unknown public input'; }
//     return role;
//   };

MerkleMembershipsPlugin satisfies
  IMinAuthPluginFactory<
    IMinAuthPlugin<MerkleMembershipsPublicInputArgs, Field>,
    MinaTreesProviderConfiguration,
    MerkleMembershipsPublicInputArgs,
    Field>;
