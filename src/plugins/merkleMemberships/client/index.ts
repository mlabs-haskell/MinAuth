import { Field, JsonProof, MerkleTree, SelfProof } from 'o1js';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import { IMinAuthProver, IMinAuthProverFactory } from '@lib/client/prover';
import * as A from 'fp-ts/Array';
import axios from 'axios';
import { TaskEither } from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as NE from 'fp-ts/NonEmptyArray';
import { fromFailablePromise } from '@utils/fp/TaskEither';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import * as z from 'zod';
import { FpInterfaceType } from '@lib/common/interfaceKind';

export type MembershipsProverConfiguration = {
  baseUrl: string;
};

export type MembershipsPublicInputArgs = Array<{
  treeRoot: Field;
  leafIndex: bigint;
}>;

type ZkProof = SelfProof<ZkProgram.PublicInput, ZkProgram.PublicOutput>;

// Prove that you belong to a set of user without revealing which user you are.
export class MembershipsProver
  implements
    IMinAuthProver<
      FpInterfaceType,
      MembershipsPublicInputArgs,
      Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
      Array<Field>
    >
{
  readonly __interface_tag = 'fp';

  private readonly cfg: MembershipsProverConfiguration;

  prove(
    publicInput: Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
    secretInput: Array<Field>
  ): TaskEither<string, JsonProof> {
    const computeBaseProof = ([[root, witness], secret]: [
      [ZkProgram.PublicInput, ZkProgram.TreeWitness],
      Field
    ]): TaskEither<string, ZkProof> =>
      fromFailablePromise(
        () =>
          ZkProgram.Program.baseCase(
            root,
            new ZkProgram.PrivateInput({ witness, secret })
          ),
        'failed in base case'
      );

    // For each pair of inputs (secret and public) add another layer of the recursive proof
    const computeRecursiveProof =
      (l: Array<[[ZkProgram.PublicInput, ZkProgram.TreeWitness], Field]>) =>
      (sp: ZkProof): TaskEither<string, ZkProof> =>
        A.foldLeft(
          // Pattern matching, not actually folding
          () => TE.right(sp),
          (
            [[root, witness], secret]: [
              [ZkProgram.PublicInput, ZkProgram.TreeWitness],
              Field
            ],
            tail
          ) =>
            pipe(
              fromFailablePromise(
                () =>
                  ZkProgram.Program.inductiveCase(
                    root,
                    sp,
                    new ZkProgram.PrivateInput({ witness, secret })
                  ),
                'failed in inductive case'
              ),
              TE.chain((proof) => computeRecursiveProof(tail)(proof))
            )
        )(l);

    const computeFinalProof = (
      pl: NonEmptyArray<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
      sl: NonEmptyArray<Field>
    ): TaskEither<string, ZkProof> => {
      const l = NE.zip(pl, sl);
      const h = NE.head(l);
      const t = NE.tail(l);
      return pipe(computeBaseProof(h), TE.chain(computeRecursiveProof(t)));
    };

    return pipe(
      TE.Do,
      TE.tap(() =>
        publicInput.length != secretInput.length
          ? TE.left('unmatched public/secret input list')
          : TE.right(undefined)
      ),
      TE.bind('publicInputNE', () =>
        TE.fromOption(() => 'public input list empty')(
          NE.fromArray(publicInput)
        )
      ),
      TE.bind('secretInputNE', () =>
        TE.fromOption(() => 'private input list empty')(
          NE.fromArray(secretInput)
        )
      ),
      TE.chain(({ publicInputNE, secretInputNE }) =>
        computeFinalProof(publicInputNE, secretInputNE)
      ),
      TE.map((finalProof) => finalProof.toJSON())
    );
  }

  // fetchPublicInputs(
  //   args: MembershipsPublicInputArgs
  // ): TaskEither<string, Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
  //   const getRootAndWitness = async (
  //     treeRoot: Field,
  //     leafIndex: bigint
  //   ): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
  //     const url = `${this.cfg.baseUrl}/getRootAndWitness/${treeRoot
  //       .toBigInt()
  //       .toString()}/${leafIndex.toString()}`;
  //     const resp = await axios.get(url);
  //     if (resp.status == 200) {
  //       const body: { leaves: Array<string | undefined> } = resp.data;
  //       const tree = new MerkleTree(ZkProgram.TREE_HEIGHT);
  //       body.leaves.forEach((leaf, index) => {
  //         if (leaf !== undefined) tree.setLeaf(BigInt(index), Field.from(leaf));
  //       });
  //       const witness = new ZkProgram.TreeWitness(tree.getWitness(leafIndex));
  //       return [new ZkProgram.PublicInput({ merkleRoot: treeRoot }), witness];
  //     } else {
  //       const body: { error: string } = resp.data;
  //       throw `error while getting root and witness: ${body.error}`;
  //     }
  //   };

  //   return fromFailablePromise(
  //     () =>
  //       Promise.all(
  //         A.map(
  //           (args: {
  //             treeRoot: Field;
  //             leafIndex: bigint;
  //           }): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> =>
  //             getRootAndWitness(args.treeRoot, args.leafIndex)
  //         )(args)
  //       ),
  //     'unable to fetch inputs'
  //   );
  // }

  fetchPublicInputs(
    args: MembershipsPublicInputArgs
  ): TaskEither<string, Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
    const getRootAndWitness = async (
      treeRoot: Field,
      leafIndex: bigint
    ): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
      const url = `${this.cfg.baseUrl}/getLeaves/${treeRoot
        .toBigInt()
        .toString()}`;
      const resp = await axios.get(url);
      if (resp.status == 200) {
        const leaves: Array<string | null> = await z
          .array(z.string().nullable())
          .parseAsync(resp.data);
        const tree = new MerkleTree(ZkProgram.TREE_HEIGHT);
        leaves.forEach((leaf, index) => {
          if (leaf !== null) tree.setLeaf(BigInt(index), Field.from(leaf));
        });
        const witness = new ZkProgram.TreeWitness(tree.getWitness(leafIndex));
        return [new ZkProgram.PublicInput({ merkleRoot: treeRoot }), witness];
      } else {
        const body: { error: string } = resp.data;
        throw `error while getting root and witness: ${body.error}`;
      }
    };

    return fromFailablePromise(
      () =>
        Promise.all(
          A.map(
            (args: {
              treeRoot: Field;
              leafIndex: bigint;
            }): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> =>
              getRootAndWitness(args.treeRoot, args.leafIndex)
          )(args)
        ),
      'unable to fetch inputs'
    );
  }

  constructor(cfg: MembershipsProverConfiguration) {
    this.cfg = cfg;
  }

  static readonly __interface_tag = 'fp';

  static initialize(
    cfg: MembershipsProverConfiguration
  ): TaskEither<string, MembershipsProver> {
    return pipe(
      fromFailablePromise(() => ZkProgram.Program.compile()),
      TE.map(() => new MembershipsProver(cfg))
    );
  }
}

MembershipsProver satisfies IMinAuthProverFactory<
  MembershipsProver,
  FpInterfaceType,
  MembershipsProverConfiguration,
  MembershipsPublicInputArgs,
  Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
  Array<Field>
>;

export default MembershipsProver;
