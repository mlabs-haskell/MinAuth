import { Field, JsonProof, MerkleTree, SelfProof, Cache } from 'o1js';
import * as ZkProgram from './merklemembershipsprogram.js';
import {
  IMinAuthProver,
  IMinAuthProverFactory
} from 'minauth/plugin/plugintype.js';
import * as A from 'fp-ts/lib/Array.js';
import axios from 'axios';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import * as NE from 'fp-ts/lib/NonEmptyArray.js';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray.js';
import { FpInterfaceType } from 'minauth/plugin/interfacekind.js';
import * as z from 'zod';
import { fromFailablePromise } from 'minauth/utils/fp/taskeither.js';

/**
 * Configuration for the prover.
 */
export type MembershipsProverConfiguration = {
  baseUrl: string;
};

export type MembershipsPublicInputArgs = Array<{
  /** The root of the merkle tree that the prover is trying to prove membership
   *  in. */
  treeRoot: Field;
  /** Note that the leaf index is not part of the proof public input,
   *  but it is required to build one. */
  leafIndex: bigint;
}>;

type ZkProof = SelfProof<ZkProgram.PublicInput, ZkProgram.PublicOutput>;

/**
 * With this class you can build proofs and interact with `MerkleMembershipsPlugin`.
 * The zk-circuit will check knowledge of a secret and its witness in merkle trees.
 * Proving this knowledge can be understood as proving membership in a set of users.
 * Because of recursion one can prove membership in multiple sets in one proof.
 */
export class MembershipsProver
  implements
    IMinAuthProver<
      FpInterfaceType,
      MembershipsPublicInputArgs,
      Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
      Array<Field>
    >
{
  /** This class uses the functionl style interface of the plugin. */
  readonly __interface_tag = 'fp';

  private readonly cfg: MembershipsProverConfiguration;

  /**
   * Build a proof for given inputs.
   * Note that even though TreeWitness is passed as public input, it should not be known to the verifier.
   * TODO fix the above
   */
  prove(
    publicInput: Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>,
    secretInput: Array<Field>
  ): TaskEither<string, JsonProof> {
    const computeBaseProof = ([[root, witness], secret]: [
      [ZkProgram.PublicInput, ZkProgram.TreeWitness],
      Field
    ]): TaskEither<string, ZkProof> =>
      // lay the base layer of the recursive proof
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

    // actually compute the proof
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

  /**
   * Fetch the data necessary to build the proof inputs.
   * In this case these are Merkle trees related to the roots
   * passed as arguments.
   */
  fetchPublicInputs(
    args: MembershipsPublicInputArgs
  ): TaskEither<string, Array<[ZkProgram.PublicInput, ZkProgram.TreeWitness]>> {
    const getRootAndWitness = async (
      treeRoot: Field,
      leafIndex: bigint
    ): Promise<[ZkProgram.PublicInput, ZkProgram.TreeWitness]> => {
      // fetch the leaves of the tree
      const url = `${this.cfg.baseUrl}/getLeaves/${treeRoot
        .toBigInt()
        .toString()}`;
      const resp = await axios.get(url);

      if (resp.status == 200) {
        // successfully fetched the leaves
        const leaves: Array<string | null> = await z
          .array(z.string().nullable())
          .parseAsync(resp.data);
        // build the tree and the witness
        const tree = new MerkleTree(ZkProgram.TREE_HEIGHT);
        leaves.forEach((leaf, index) => {
          if (leaf !== null) tree.setLeaf(BigInt(index), Field.from(leaf));
        });
        const witness = new ZkProgram.TreeWitness(tree.getWitness(leafIndex));
        return [new ZkProgram.PublicInput({ merkleRoot: treeRoot }), witness];
      } else {
        // failed to fetch the leaves
        const body: { error: string } = resp.data;
        throw `error while getting root and witness: ${body.error}`;
      }
    };

    return fromFailablePromise(
      () =>
        // foreach merkle root return the tree root and the witness
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

  /** Compile the underlying zk circuit */
  static compile(): TaskEither<string, { verificationKey: string }> {
    // disable cache because of bug in o1js 0.14.1:
    // you have a verification key acquired by using cached circuit AND
    // not build a proof locally,
    // but use a serialized one - it will hang during verification.
    return fromFailablePromise(() =>
      ZkProgram.Program.compile({ cache: Cache.None })
    );
  }

  static initialize(
    cfg: MembershipsProverConfiguration,
    compile: boolean = true
  ): TaskEither<string, MembershipsProver> {
    return pipe(
      compile
        ? TE.tryCatch(
            MembershipsProver.compile(),
            (e) => 'Error compiling: ' + String(e)
          )
        : TE.right({ verificationKey: '' }),
      () => TE.right(new MembershipsProver(cfg))
    );
  }
}

MembershipsProver satisfies IMinAuthProverFactory<
  FpInterfaceType,
  MembershipsProver,
  MembershipsProverConfiguration
>;

export default MembershipsProver;
