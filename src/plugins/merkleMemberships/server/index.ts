import { Experimental, Field, JsonProof, Poseidon } from 'o1js';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import z from 'zod';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory
} from '@lib/plugin/fp/pluginType';
import {
  MinaTreesProvider,
  MinaTreesProviderConfiguration,
  TreesProvider,
  minaTreesProviderConfigurationSchema
} from './treeStorage';
import { Router } from 'express';
import { TaskEither } from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as T from 'fp-ts/Task';
import * as Str from 'fp-ts/string';
import * as IOE from 'fp-ts/IOEither';
import {
  fromFailableIO,
  fromFailablePromise,
  guardPassthrough,
  safeGetFieldParam,
  safeGetNumberParam,
  wrapTrivialExpressHandler
} from '@utils/fp/TaskEither';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import * as NE from 'fp-ts/NonEmptyArray';
import * as S from 'fp-ts/Semigroup';
import { FpInterfaceType } from '@lib/plugin/fp/interfaceKind';

const PoseidonHashSchema = z.string();

const publicInputArgsSchema = z.array(PoseidonHashSchema);

export type PublicInputArgs = z.infer<typeof publicInputArgsSchema>;

export class MerkleMembershipsPlugin
  implements IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Field>
{
  readonly __interface_tag = 'fp';

  readonly verificationKey: string;
  private readonly storageProvider: TreesProvider;

  readonly customRoutes: Router = Router()
    .get(
      '/getLeaves/:treeRoot/',
      wrapTrivialExpressHandler((req) =>
        pipe(
          TE.Do,
          TE.bind('treeRoot', () => safeGetFieldParam('treeRoot', req.params)),
          TE.chain(({ treeRoot }) =>
            pipe(
              this.storageProvider.getTree(treeRoot),
              TE.chain(
                TE.fromOption(
                  () => `tree with root ${treeRoot.toString()} missing`
                )
              ),
              TE.chain((tree) => tree.getLeaves()),
              TE.map(A.map(O.toUndefined))
            )
          )
        )
      )
    )
    .get(
      '/getWitness/:treeRoot/:leafIndex',
      wrapTrivialExpressHandler((req) => {
        const getNumberParam = (key: string) =>
          safeGetNumberParam(key, req.params);
        const getFieldParam = (key: string) =>
          safeGetFieldParam(key, req.params);
        return pipe(
          TE.Do,
          TE.bind('treeRoot', () => getFieldParam('treeRoot')),
          TE.bind('leafIndex', () => getNumberParam('leafIndex')),
          TE.chain(({ treeRoot, leafIndex }) =>
            pipe(
              this.storageProvider.getTree(treeRoot),
              TE.chain(
                TE.fromOption(
                  () => `tree with root ${treeRoot.toString()} missing`
                )
              ),
              TE.chain((tree) => tree.getWitness(BigInt(leafIndex))),
              TE.chain(TE.fromOption(() => 'invalid leaf index'))
            )
          )
        );
      })
    );

  readonly publicInputArgsSchema = publicInputArgsSchema;

  verifyAndGetOutput(
    publicInputArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): TaskEither<string, Field> {
    const treeRoots = pipe(
      TE.fromOption(() => 'empty input list')(NE.fromArray(publicInputArgs)),
      TE.chain(
        NE.traverse(TE.ApplicativePar)((x: string) =>
          fromFailableIO(() => Field.from(x))
        )
      )
    );

    const deserializedProof = TE.fromIOEither(
      IOE.tryCatch(
        () =>
          Experimental.ZkProgram.Proof(ZkProgram.Program).fromJSON(
            serializedProof
          ),
        (err) => String(err)
      )
    );

    const computeExpectedHash = (
      roots: NonEmptyArray<Field>
    ): TaskEither<string, Field> =>
      pipe(
        NE.traverse(
          TE.getApplicativeTaskValidation(
            T.ApplySeq,
            pipe(Str.Semigroup, S.intercalate(', '))
          )
        )((root: Field) =>
          pipe(
            this.storageProvider.getTree(root),
            TE.chain(
              TE.fromOption(
                () => `unable to find tree with root ${root.toString()}`
              )
            ),
            TE.chain(() => TE.right(root))
          )
        )(roots),
        TE.map((roots: NonEmptyArray<Field>) =>
          A.reduce(NE.head(roots), (acc, x: Field) => Poseidon.hash([x, acc]))(
            NE.tail(roots)
          )
        )
      );

    return pipe(
      TE.Do,
      TE.bind('treeRoots', () => treeRoots),
      TE.bind('deserializedProof', () => deserializedProof),
      TE.bind('expectedHash', ({ treeRoots }) =>
        computeExpectedHash(treeRoots)
      ),
      TE.chain(({ expectedHash, deserializedProof }) =>
        guardPassthrough(
          expectedHash
            .equals(deserializedProof.publicOutput.recursiveHash)
            .toBoolean(),
          'unexpected recursive hash'
        )(expectedHash)
      )
    );
  }

  constructor(verificationKey: string, storageProvider: TreesProvider) {
    this.verificationKey = verificationKey;
    this.storageProvider = storageProvider;
  }

  static readonly __interface_tag = 'fp';

  static initialize(
    cfg: MinaTreesProviderConfiguration
  ): TaskEither<string, MerkleMembershipsPlugin> {
    return pipe(
      TE.Do,
      TE.bind('compilationResult', () =>
        fromFailablePromise(
          ZkProgram.Program.compile,
          'bug: unable to compile MerkleMembershipsProgram'
        )
      ),
      TE.bind('storage', () => MinaTreesProvider.initialize(cfg)),
      TE.map(
        ({ compilationResult, storage }) =>
          new MerkleMembershipsPlugin(
            compilationResult.verificationKey,
            storage
          )
      )
    );
  }

  static readonly configurationSchema = minaTreesProviderConfigurationSchema;
}

MerkleMembershipsPlugin satisfies IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Field>,
  MinaTreesProviderConfiguration,
  PublicInputArgs,
  Field
>;

export default MerkleMembershipsPlugin;
