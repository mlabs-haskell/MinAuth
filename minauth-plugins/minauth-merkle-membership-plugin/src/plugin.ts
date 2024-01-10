import { Field, JsonProof, Poseidon, ZkProgram, verify } from 'o1js';
import { Program } from './merklemembershipsprogram.js';
import z from 'zod';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid
} from 'minauth/dist/plugin/plugintype.js';
import {
  MinaTreesProvider,
  MinaTreesProviderConfiguration,
  TreesProvider,
  minaTreesProviderConfigurationSchema
} from './treestorage.js';
import { Router } from 'express';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import { pipe } from 'fp-ts/lib/function.js';
import * as TE from 'fp-ts/lib/TaskEither.js';
import * as IOE from 'fp-ts/lib/IOEither.js';
import {
  fromFailablePromise,
  guard,
  safeGetFieldParam
} from 'minauth/dist/utils/fp/taskeither.js';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray.js';
import * as NE from 'fp-ts/lib/NonEmptyArray.js';
import { FpInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import * as E from 'fp-ts/lib/Either.js';
import * as O from 'fp-ts/lib/Option.js';
import * as A from 'fp-ts/lib/Array.js';
import {
  Decoder,
  EncodeDecoder,
  wrapZodDec
} from 'minauth/dist/plugin/encodedecoder.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { wrapTrivialExpressHandler } from 'minauth/dist/plugin/express.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { fieldEncDec } from 'minauth/dist/utils/fp/fieldEncDec.js';

/**
 * The type of the public input of the Minauth plugin.
 * The public input is a list of Merkle tree roots.
 * Each tree represents a set of authorized members.
 */
export type PublicInputArgs = NonEmptyArray<Field>;

/**
 * Encode/decode `PublicInputArgs` to/from an array of strings.
 */
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

/**
 * The type of the output of the MerkleMemberships Minauth plugin.
 */
export type Output = {
  /** The input used to generate the proof related to this output. */
  publicInputArgs: PublicInputArgs;
  /** The hash informing the plugin to which trees the proof relates. */
  recursiveHash: Field;
};

/**
 * Encode/decode `Output` to/from an object.
 */
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

/**
 * An error used by the plugin
 */
type ComputeExpectedHashError =
  | {
      __kind: 'tree_missing';
      root: Field;
    }
  | {
      __kind: 'other';
      error: string;
    };

const treeMissingError = (root: Field): ComputeExpectedHashError => {
  return {
    __kind: 'tree_missing',
    root
  };
};

const otherError = (error: string): ComputeExpectedHashError => {
  return {
    __kind: 'other',
    error
  };
};

const computeExpectedHashErrorToString = (
  e: ComputeExpectedHashError
): string =>
  e.__kind == 'tree_missing'
    ? `tree with root ${e.root.toString()} not found`
    : e.error;

/** There's a particular hash connected to a set of roots.
 *  It is also computed by the zk program that generates the proof.
 *  This function computes the expected hash.
 *  To understand the hash construction consult `merkleMembershipsProgram.ts`
 */
const computeExpectedHash =
  (forest: TreesProvider) =>
  (roots: NonEmptyArray<Field>): TaskEither<ComputeExpectedHashError, Field> =>
    pipe(
      NE.traverse(TE.ApplicativeSeq)((root: Field) =>
        pipe(
          forest.getTree(root),
          TE.mapLeft(otherError),
          TE.tap(TE.fromOption(() => treeMissingError(root))),
          TE.map(() => root)
        )
      )(roots),
      TE.map((roots: NonEmptyArray<Field>) =>
        A.reduce(NE.head(roots), (acc, x: Field) => Poseidon.hash([x, acc]))(
          NE.tail(roots)
        )
      )
    );

/**
 * The MerkleMemberships Minauth plugin.
 * The plugin keeps a configured set of Merkle trees.
 * Each tree represents a set of authorized members.
 * A user can prove that they are a member of a set by providing
 * a Merkle witness to a known secret within a tree.
 * The user identity is not revealed - only the set of proven
 * memberships
 */
export class MerkleMembershipsPlugin
  implements IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output>
{
  readonly __interface_tag = 'fp';

  readonly verificationKey: VerificationKey;
  private readonly storageProvider: TreesProvider;

  readonly logger: Logger;

  /**
   * A set of express.js routes for communicating with the prover.
   */
  readonly customRoutes: Router = Router()
    .get(
      /** Return all the leaves for a given tree root */
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
    /** Return all merkle tree roots supported the plugin */
    .get(
      '/getTreeRoots',
      wrapTrivialExpressHandler(() => this.storageProvider.getTreeRoots())
    );

  /** Given public input description and a zk proof validate the proof
   *  and produce the output
   */
  verifyAndGetOutput(
    publicInputArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): TaskEither<string, Output> {
    const treeRoots = TE.fromOption(() => 'empty input list')(
      NE.fromArray(publicInputArgs)
    );

    const deserializedProof = TE.fromIOEither(
      IOE.tryCatch(
        () => ZkProgram.Proof(Program).fromJSON(serializedProof),
        (err) => String(err)
      )
    );

    return pipe(
      TE.Do,
      TE.bind('treeRoots', () => treeRoots),
      TE.bind('deserializedProof', () => deserializedProof),
      TE.bind('proofIsValid', ({ deserializedProof }) =>
        fromFailablePromise(
          () => verify(deserializedProof, this.verificationKey),
          'Error during proof verification'
        )
      ),
      TE.tap(({ proofIsValid }) =>
        guard(proofIsValid, 'The proof was verified and it is invalid.')
      ),
      TE.bind('expectedHash', ({ treeRoots }) =>
        pipe(
          computeExpectedHash(this.storageProvider)(treeRoots),
          TE.mapLeft(computeExpectedHashErrorToString),
          TE.tapIO(
            (hash) => () => this.logger.debug(`expected hash`, hash.toString())
          )
        )
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

  /**
   * The output of the plugin may become invalid if the underlying
   * Merkle trees got updated. This function checks if the output
   * is still valid.
   */
  checkOutputValidity(o: Output): TaskEither<string, OutputValidity> {
    return pipe(
      computeExpectedHash(this.storageProvider)(o.publicInputArgs),
      TE.map(
        (expectedHash): OutputValidity =>
          expectedHash.equals(o.recursiveHash).toBoolean()
            ? outputValid
            : outputInvalid('invalid revursive hash')
      ),
      TE.orElse((err) =>
        err.__kind == 'other'
          ? TE.left(err.error)
          : TE.right(outputInvalid(`tree missing: ${err.root.toString()}`))
      )
    );
  }

  constructor(
    verificationKey: VerificationKey,
    storageProvider: TreesProvider,
    logger: Logger
  ) {
    this.verificationKey = verificationKey;
    this.storageProvider = storageProvider;
    this.logger = logger;
  }

  static readonly __interface_tag = 'fp';

  /**
   * Initialize plugin with a typed configuration.
   */
  static initialize(
    cfg: MinaTreesProviderConfiguration,
    logger: Logger
  ): TaskEither<string, MerkleMembershipsPlugin> {
    return pipe(
      TE.Do,
      TE.bind('compilationResult', () =>
        fromFailablePromise(
          Program.compile,
          'bug: unable to compile MerkleMembershipsProgram'
        )
      ),
      TE.bind('storage', () => MinaTreesProvider.initialize(cfg)),
      TE.map(
        ({ compilationResult, storage }) =>
          new MerkleMembershipsPlugin(
            compilationResult.verificationKey,
            storage,
            logger
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
