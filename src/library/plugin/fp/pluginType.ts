import { Router } from 'express';
import { JsonProof } from 'o1js';
import {
  InterfaceKind,
  WithInterfaceTag,
  RetType,
  TsInterfaceType,
  FpInterfaceType,
  ChooseType
} from './interfaceKind';
import { fromFailablePromise } from '@utils/fp/TaskEither';
import { Either } from 'fp-ts/Either';
import * as E from 'fp-ts/Either';
import * as z from 'zod';

// TODO: Should probably move all these to `utils`
export interface Decoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  decode: (
    _: unknown
  ) => ChooseType<InterfaceType, Either<string, T>, T | undefined>;
}

const tsToFpDecoder = <T>(
  tsDec: Decoder<TsInterfaceType, T>
): Decoder<FpInterfaceType, T> => {
  return {
    __interface_tag: 'fp',
    decode: (i) => E.fromNullable('unable to parse')(tsDec.decode(i))
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Encoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  // Encoding should never failed. The returned value should be able to
  // serialize using `JSON.stringify`.
  encode: (_: T) => unknown;
}

const tsToFpEncoder = <T>(
  tsEnc: Encoder<TsInterfaceType, T>
): Encoder<FpInterfaceType, T> => {
  return {
    __interface_tag: 'fp',
    encode: tsEnc.encode
  };
};

export type EncodeDecoder<InterfaceType extends InterfaceKind, T> = Encoder<
  InterfaceType,
  T
> &
  Decoder<InterfaceType, T>;

export const __encDecLaw = <T>(
  input: T,
  enc: Encoder<FpInterfaceType, T>,
  dec: Decoder<FpInterfaceType, T>
): boolean =>
  E.match(
    () => false,
    (decoded) => decoded === input
  )(dec.decode(enc.encode(input)));

export const wrapTrivialEnc = <InterfaceType extends InterfaceKind, T>(
  i: InterfaceType
): Encoder<InterfaceType, T> => {
  return {
    __interface_tag: i,
    encode: (inp: T) => inp as unknown
  };
};

export const wrapZodDec = <InterfaceType extends InterfaceKind, T>(
  i: InterfaceType,
  s: z.Schema<T>
): Decoder<InterfaceType, T> => {
  const mkDecoder =
    <R>(
      onFailure: (_: z.SafeParseError<T>) => R,
      onSuccess: (_: z.SafeParseSuccess<T>) => R
    ) =>
    (o: unknown): R => {
      const parseResult = s.safeParse(o);
      return parseResult.success
        ? onSuccess(parseResult)
        : onFailure(parseResult);
    };

  const fpDec = {
    __interface_tag: 'fp',
    decode: mkDecoder(
      ({ error }) => E.left(String(error)),
      ({ data }) => E.right(data)
    )
  };

  const tsDec = {
    __interface_tag: 'ts',
    decode: mkDecoder(
      () => undefined,
      ({ data }) => data
    )
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (i === 'fp' ? fpDec : tsDec) as any;
};

export const combineEncDec = <InterfaceType extends InterfaceKind, T>(
  enc: Encoder<InterfaceType, T>,
  dec: Decoder<InterfaceType, T>
): EncodeDecoder<InterfaceType, T> => {
  return {
    ...enc,
    ...dec
  };
};

// Interfaces used on the server side.

export interface IMinAuthPlugin<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  // Verify a proof give the arguments for fetching public inputs, and return
  // the output.
  verifyAndGetOutput(
    publicInputArgs: PublicInputArgs,
    serializedProof: JsonProof
  ): RetType<InterfaceType, Output>;

  /**
   * Plugins should be able to confirm the validity produced outputs.
   * Most outputs along with underlying proofs can get outdated by
   * changes to the data that the proof is based on.
   */
  checkOutputValidity(output: Output): RetType<InterfaceType, void>;

  // Custom routes and handlers. Will be installed under `/plugins/<plugin name>`
  readonly customRoutes: Router;

  // The verification key of the underlying zk circuit.
  readonly verificationKey: string;
}

// TODO: generic type inference?
export interface IMinAuthPluginFactory<
  InterfaceType extends InterfaceKind,
  PluginType extends IMinAuthPlugin<InterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs,
  Output
> extends WithInterfaceTag<InterfaceType> {
  // Initialize the plugin given the configuration. The underlying zk program is
  // typically compiled here.
  initialize(cfg: Configuration): RetType<InterfaceType, PluginType>;

  readonly configurationDec: Decoder<InterfaceType, Configuration>;

  readonly publicInputArgsDec: Decoder<InterfaceType, PublicInputArgs>;

  readonly outputEncDec: EncodeDecoder<InterfaceType, Output>;
}

// Interfaces used on the client side.

export interface IMinAuthProver<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  PublicInput,
  PrivateInput
> extends WithInterfaceTag<InterfaceType> {
  prove(
    publicInput: PublicInput,
    secretInput: PrivateInput
  ): RetType<InterfaceType, JsonProof>;

  fetchPublicInputs(args: PublicInputArgs): RetType<InterfaceType, PublicInput>;
}

export interface IMinAuthProverFactory<
  ProverType extends IMinAuthProver<
    InterfaceType,
    PublicInputArgs,
    PublicInput,
    PrivateInput
  >,
  InterfaceType extends InterfaceKind,
  Configuration,
  PublicInputArgs,
  PublicInput,
  PrivateInput
> extends WithInterfaceTag<InterfaceType> {
  initialize(cfg: Configuration): RetType<InterfaceType, ProverType>;
}

// ts -> fp

export const tsToFpMinAuthPlugin = <PublicInputArgs, Output>(
  i: IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>
): IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output> => {
  return {
    __interface_tag: 'fp',
    verifyAndGetOutput: (pia, sp) =>
      fromFailablePromise(() => i.verifyAndGetOutput(pia, sp)),
    checkOutputValidity: (o) =>
      fromFailablePromise(() => i.checkOutputValidity(o)),
    customRoutes: i.customRoutes,
    verificationKey: i.verificationKey
  };
};

export const tsToFpMinAuthPluginFactory = <
  Configuration,
  PublicInputArgs,
  Output
>(
  i: IMinAuthPluginFactory<
    TsInterfaceType,
    IMinAuthPlugin<TsInterfaceType, PublicInputArgs, Output>,
    Configuration,
    PublicInputArgs,
    Output
  >
): IMinAuthPluginFactory<
  FpInterfaceType,
  IMinAuthPlugin<FpInterfaceType, PublicInputArgs, Output>,
  Configuration,
  PublicInputArgs,
  Output
> => {
  return {
    __interface_tag: 'fp',
    configurationDec: tsToFpDecoder(i.configurationDec),
    publicInputArgsDec: tsToFpDecoder(i.publicInputArgsDec),
    outputEncDec: combineEncDec(
      tsToFpEncoder(i.outputEncDec),
      tsToFpDecoder(i.outputEncDec)
    ),
    initialize: (cfg) =>
      fromFailablePromise(() => i.initialize(cfg).then(tsToFpMinAuthPlugin))
  };
};
