import { Field, JsonProof, MerkleTree, SelfProof } from 'o1js';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import { IMinAuthProver, IMinAuthProverFactory } from '@lib/plugin/pluginType';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import axios from 'axios';

export type ProverConfiguration = {
  baseUrl: string;
};

export type PublicInputArgs = Array<{
  treeRoot: Field;
  leafIndex: bigint;
}>;

type ZkProof = SelfProof<ZkProgram.PublicInput, ZkProgram.PublicOutput>;

// Prove that you belong to a set of user without revealing which user you are.
export class MerkleMembershipsProver
  implements
    IMinAuthProver<
      PublicInputArgs,
      Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
      Array<Field>
    >
{
  private readonly cfg: ProverConfiguration;

  async prove(
    publicInput: Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
    secretInput: Array<Field>
  ): Promise<JsonProof> {
    if (publicInput.length != secretInput.length)
      throw 'unmatched public/secret input list';

    const proof: O.Option<ZkProof> = await A.reduce(
      Promise.resolve<O.Option<ZkProof>>(O.none),
      (
        acc,
        [[root, witness], secret]: [
          [ZkProgram.PublicInput, ZkProgram.TreeWitness],
          Field
        ]
      ) => {
        const privInput = new ZkProgram.PrivateInput({ witness, secret });
        return acc.then(
          O.match(
            () => ZkProgram.Program.baseCase(root, privInput).then(O.some),
            (prev) =>
              ZkProgram.Program.inductiveCase(root, prev, privInput).then(
                O.some
              )
          )
        );
      }
    )(A.zip(publicInput, secretInput));

    return O.match(
      () => {
        throw 'empty input list';
      }, // TODO: make it pure
      (p: ZkProof) => p.toJSON()
    )(proof);
  }

  // async fetchPublicInputs(
  //   args: PublicInputArgs
  // ): Promise<Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
  //   const mkUrl = (treeRoot: Field, leafIndex: bigint) =>
  //     `${this.cfg.baseUrl}/getWitness/${treeRoot
  //       .toBigInt()
  //       .toString()}/${leafIndex.toString()}`;
  //   const getRootAndWitness = async (
  //     treeRoot: Field,
  //     leafIndex: bigint
  //   ): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
  //     const url = mkUrl(treeRoot, leafIndex);
  //     const resp = await axios.get(url);
  //     if (resp.status == 200) {
  //       const body: {
  //         witness: string;
  //       } = resp.data;
  //       const witness = ZkProgram.TreeWitness.fromJSON(body.witness);
  //       return [new ZkProgram.PublicInput({ merkleRoot: treeRoot }), witness];
  //     } else {
  //       const body: { error: string } = resp.data;
  //       throw `error while getting root and witness: ${body.error}`;
  //     }
  //   };

  //   return Promise.all(
  //     A.map((args: { treeRoot: Field; leafIndex: bigint }) =>
  //       getRootAndWitness(args.treeRoot, args.leafIndex)
  //     )(args)
  //   );
  // }

  async fetchPublicInputs(
    args: PublicInputArgs
  ): Promise<Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
    const getRootAndWitness = async (
      treeRoot: Field,
      leafIndex: bigint
    ): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
      const mkUrl = (treeRoot: Field) =>
        `${this.cfg.baseUrl}/getLeaves/${treeRoot.toBigInt()}`;
      const url = mkUrl(treeRoot);
      const resp = await axios.get(url);
      if (resp.status == 200) {
        const body: { leaves: Array<string | undefined> } = resp.data;
        const tree = new MerkleTree(ZkProgram.TREE_HEIGHT);
        body.leaves.forEach((leaf, index) => {
          if (leaf !== undefined) tree.setLeaf(BigInt(index), Field.from(leaf));
        });
        const witness = new ZkProgram.TreeWitness(tree.getWitness(leafIndex));
        return [new ZkProgram.PublicInput({ merkleRoot: treeRoot }), witness];
      } else {
        const body: { error: string } = resp.data;
        throw `error while getting root and witness: ${body.error}`;
      }
    };

    return Promise.all(
      A.map((args: { treeRoot: Field; leafIndex: bigint }) =>
        getRootAndWitness(args.treeRoot, args.leafIndex)
      )(args)
    );
  }

  constructor(cfg: ProverConfiguration) {
    this.cfg = cfg;
  }

  static async initialize(
    cfg: ProverConfiguration
  ): Promise<MerkleMembershipsProver> {
    return new MerkleMembershipsProver(cfg);
  }
}

MerkleMembershipsProver satisfies IMinAuthProverFactory<
  MerkleMembershipsProver,
  ProverConfiguration,
  PublicInputArgs,
  Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
  Array<Field>
>;

export default MerkleMembershipsProver;
