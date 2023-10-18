import { Experimental, Field, JsonProof, Poseidon } from 'o1js';
import * as ZkProgram from '../common/merkleMembershipsProgram';
import z from 'zod';
import {
  Decoder,
  EncodeDecoder,
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid,
  wrapZodDec
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
  fromFailablePromise,
  guard,
  safeGetFieldParam,
  safeGetNumberParam,
  wrapTrivialExpressHandler
} from '@utils/fp/TaskEither';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import * as NE from 'fp-ts/NonEmptyArray';
import * as S from 'fp-ts/Semigroup';
import { FpInterfaceType } from '@lib/plugin/fp/interfaceKind';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';

export type PublicInputArgs = NonEmptyArray<Field>;

const fieldEncDec: EncodeDecoder<FpInterfaceType, Field> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      wrapZodDec('fp', z.string()).decode(i),
      E.chain((str) => {
        try {
          return E.right(Field.from(str));
        } catch (err) {
          return E.left('unable to construct field');
        }
      })
    ),

  encode: (i: Field) => i.toString()
};

const publicInputArgsEncDec: EncodeDecoder<FpInterfaceType, PublicInputArgs> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      wrapZodDec('fp', z.array(z.unknown())).decode(i),
      E.chain(A.traverse(E.Applicative)(fieldEncDec.decode)),
      E.chain((arr: Array<Field>) =>
        E.fromOption(() => 'empty public input')(NE.fromArray(arr))
      )
    ),

  encode: NE.map(fieldEncDec.encode)
};

export type Output = {
  publicInputArgs: PublicInputArgs;
  recursiveHash: Field;
};

const outputEncDec: EncodeDecoder<FpInterfaceType, Output> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      E.Do,
      E.bind('rawObj', () =>
        wrapZodDec(
          'fp',
          z.object({
            publicInputArgs: z.unknown(),
            recursiveHash: z.string()
          })
        ).decode(i)
      ),
      E.bind('publicInputArgs', ({ rawObj }) =>
        publicInputArgsEncDec.decode(rawObj.publicInputArgs)
      ),
      E.bind('recursiveHash', ({ rawObj }) =>
        fieldEncDec.decode(rawObj.recursiveHash)
      ),
      E.map(({ publicInputArgs, recursiveHash }) => {
        return {
          publicInputArgs,
          recursiveHash
        };
      })
    ),

  encode: ({ publicInputArgs, recursiveHash }) => {
    return {
      publicInputArgs: publicInputArgsEncDec.encode(publicInputArgs),
      recursiveHash: fieldEncDec.encode(recursiveHash)
    };
  }
};

const computeExpectedHash =
  (forest: TreesProvider) =>
  (roots: NonEmptyArray<Field>): TaskEither<string, Field> =>
    pipe(
      NE.traverse(
        TE.getApplicativeTaskValidation(
          T.ApplySeq,
          pipe(Str.Semigroup, S.intercalate(', '))
        )
      )((root: Field) =>
        pipe(
          forest.getTree(root),
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

export class MerkleMembershipsPlugin
  implements IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output>
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
    )
    .get(
      '/getTreeRoots',
      wrapTrivialExpressHandler(() => this.storageProvider.getTreeRoots())
    );

  verifyAndGetOutput(
    publicInputArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): TaskEither<string, Output> {
    console.log(publicInputArgs);

    const treeRoots = TE.fromOption(() => 'empty input list')(
      NE.fromArray(publicInputArgs)
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

    return pipe(
      TE.Do,
      TE.bind('treeRoots', () => treeRoots),
      TE.bind('deserializedProof', () => deserializedProof),
      TE.bind('expectedHash', ({ treeRoots }) =>
        computeExpectedHash(this.storageProvider)(treeRoots)
      ),
      TE.tap(({ expectedHash, deserializedProof }) =>
        guard(
          expectedHash
            .equals(deserializedProof.publicOutput.recursiveHash)
            .toBoolean(),
          'unexpected recursive hash'
        )
      ),
      TE.map(({ expectedHash }) => {
        return {
          publicInputArgs,
          recursiveHash: expectedHash
        };
      })
    );
  }

  checkOutputValidity(o: Output): TaskEither<string, OutputValidity> {
    return pipe(
      // FIXME: tree not found should not be an error
      computeExpectedHash(this.storageProvider)(o.publicInputArgs),
      TE.map(
        (expectedHash): OutputValidity =>
          expectedHash.equals(o.recursiveHash).toBoolean()
            ? outputValid
            : outputInvalid('invalid revursive hash')
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

  static readonly configurationDec = wrapZodDec(
    'fp',
    minaTreesProviderConfigurationSchema
  );

  static readonly publicInputArgsDec: Decoder<
    FpInterfaceType,
    PublicInputArgs
  > = publicInputArgsEncDec;

  static readonly outputEncDec = outputEncDec;
}

MerkleMembershipsPlugin satisfies IMinAuthPluginFactory<
  FpInterfaceType,
  MerkleMembershipsPlugin,
  MinaTreesProviderConfiguration
>;

export default MerkleMembershipsPlugin;
