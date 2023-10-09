import { Field, JsonProof, SelfProof } from "o1js";
import * as ZkProgram from "../common/merkleMembershipsProgram";
import { IMinAuthProver, IMinAuthProverFactory } from '../../../library/plugin/pluginType';
import * as A from 'fp-ts/Array'
import * as O from 'fp-ts/Option'
import axios from "axios";

export type ProverConfiguration = {
  baseUrl: string
}

export type PublicInputArgs =
  Array<{
    treeIndex: bigint,
    leafIndex: bigint
  }>

type ZkProof = SelfProof<ZkProgram.PublicInput, ZkProgram.PublicOutput>;

// Prove that you belong to a set of user without revealing which user you are.
export class MerkleMembershipsProver implements
  IMinAuthProver<
    PublicInputArgs,
    Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
    Array<Field>>
{
  private readonly cfg: ProverConfiguration;

  async prove(
    publicInput: Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
    secretInput: Array<Field>)
    : Promise<JsonProof> {
    if (publicInput.length != secretInput.length)
      throw "unmatched public/secret input list"

    const proof: O.Option<ZkProof> =
      await
        A.reduce
          (
            Promise.resolve<O.Option<ZkProof>>(O.none),
            (acc, [[root, witness], secret]: [[ZkProgram.PublicInput, ZkProgram.TreeWitness], Field]) => {
              const privInput = new ZkProgram.PrivateInput({ witness, secret })
              return acc.then(
                O.match(
                  () => ZkProgram.Program.baseCase(root, privInput).then(O.some),
                  (prev) => ZkProgram.Program.inductiveCase(root, prev, privInput).then(O.some)
                )
              )
            }
          )
          (A.zip(publicInput, secretInput));

    return O.match(
      () => { throw "empty input list" }, // TODO: make it pure
      (p: ZkProof) => p.toJSON()
    )(proof);
  }

  async fetchPublicInputs(args: PublicInputArgs):
    Promise<Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
    const mkUrl = (treeIndex: bigint, leafIndex: bigint) =>
      `${this.cfg.baseUrl}/getRootAndWitness/${treeIndex.toString()}/${leafIndex.toString()}`;
    const getRootAndWitness =
      async (treeIndex: bigint, leafIndex: bigint):
        Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
        const url =
          `${this.cfg.baseUrl}/getRootAndWitness/${treeIndex.toString()}/${leafIndex.toString()}`;
        const resp = await axios.get(url);
        if (resp.status == 200) {
          const body: {
            merkleRoot: string,
            witness: string
          } = resp.data;
          const merkleRoot = Field.fromJSON(body.merkleRoot);
          const witness = ZkProgram.TreeWitness.fromJSON(body.witness);
          return [new ZkProgram.PublicInput({ merkleRoot }), witness];
        } else {
          const body: { error: string } = resp.data;
          throw `error while getting root and witness: ${body.error}`;
        }
      }

    return Promise.all(A.map(
      (args: {
        treeIndex: bigint,
        leafIndex: bigint
      }) =>
        getRootAndWitness(args.treeIndex, args.leafIndex)
    )(args));
  }

  constructor(cfg: ProverConfiguration) {
    this.cfg = cfg;
  }

  static async initialize(cfg: ProverConfiguration):
    Promise<MerkleMembershipsProver> {
    return new MerkleMembershipsProver(cfg);
  }
}

MerkleMembershipsProver satisfies IMinAuthProverFactory<
  MerkleMembershipsProver,
  ProverConfiguration,
  PublicInputArgs,
  Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
  Array<Field>
>

export default MerkleMembershipsProver;