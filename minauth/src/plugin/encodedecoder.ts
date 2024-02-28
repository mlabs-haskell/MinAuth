import {
  InterfaceKind,
  WithInterfaceTag,
  TsInterfaceType,
  FpInterfaceType,
  ChooseType
} from './interfacekind.js';
import { Either } from 'fp-ts/lib/Either.js';
import * as E from 'fp-ts/lib/Either.js';
import * as z from 'zod';

/**
 * An interface for the decoder concept.
 * Availble in both idiomatic typescript and functional styles.
 */
export interface Decoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  decode: (
    _: unknown
  ) => ChooseType<InterfaceType, Either<string, T>, T | undefined>;
}

/**
 *  Convert a decoder from the idiomatic typescript interface to the functional style.
 */
export const tsToFpDecoder = <T>(
  tsDec: Decoder<TsInterfaceType, T>
): Decoder<FpInterfaceType, T> => {
  return {
    __interface_tag: 'fp',
    decode: (i) => E.fromNullable('unable to parse')(tsDec.decode(i))
  };
};

/**
 *  Convert a decoder from the functional interface to the idiomatic typescript style.
 */
export const fpToTsDecoder = <T>(
  fpDec: Decoder<FpInterfaceType, T>
): Decoder<TsInterfaceType, T> => {
  return {
    __interface_tag: 'ts',
    decode: (i: unknown) =>
      E.fold(
        () => undefined as T | undefined,
        (r) => r as T
      )(fpDec.decode(i))
  };
};

/**
 * An interface for the encoder concept.
 * Encoding MUST NOT fail.
 * The returned value MUST serializable via `JSON.stringify`.
 */
export interface Encoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  encode: (_: T) => unknown;
}

/**
 * Convert an encoder from the idiomatic typescript interface to the functional style
 */
export const tsToFpEncoder = <T>(
  tsEnc: Encoder<TsInterfaceType, T>
): Encoder<FpInterfaceType, T> => {
  return {
    __interface_tag: 'fp',
    encode: tsEnc.encode
  };
};

/**
 * Convert an encoder from the idiomatic typescript interface to the functional style
 */
export const fpToTsEncoder = <T>(
  tsEnc: Encoder<FpInterfaceType, T>
): Encoder<TsInterfaceType, T> => {
  return {
    __interface_tag: 'ts',
    encode: tsEnc.encode
  };
};

/** A combined encoder and decoder */
export type EncodeDecoder<InterfaceType extends InterfaceKind, T> = Encoder<
  InterfaceType,
  T
> &
  Decoder<InterfaceType, T>;

/**
 * This laws should hold
 */
export const __encDecLaw = <T>(
  input: T,
  enc: Encoder<FpInterfaceType, T>,
  dec: Decoder<FpInterfaceType, T>
): boolean =>
  E.match(
    () => false,
    (decoded) => decoded === input
  )(dec.decode(enc.encode(input)));

/**
 * This is an encoder that just casts the object using "as unknown"
 */
export const noOpEncoder = <InterfaceType extends InterfaceKind, T>(
  i: InterfaceType
): Encoder<InterfaceType, T> => {
  return {
    __interface_tag: i,
    encode: (inp: T) => inp as unknown
  };
};

/**
 * Create a decoder out of a zod schema parser
 */
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

  return (i === 'fp' ? fpDec : tsDec) as Decoder<InterfaceType, T>;
};

/**
 * Combine a decoder and an encoder into a single object.
 */
export const combineEncDec = <InterfaceType extends InterfaceKind, T>(
  enc: Encoder<InterfaceType, T>,
  dec: Decoder<InterfaceType, T>
): EncodeDecoder<InterfaceType, T> => {
  return {
    ...enc,
    ...dec
  };
};

export const fpToTsEncDec = <T>(
  fpEncDec: EncodeDecoder<FpInterfaceType, T>
): EncodeDecoder<TsInterfaceType, T> => {
  return {
    __interface_tag: 'ts',
    encode: fpEncDec.encode,
    decode: fpToTsDecoder(fpEncDec).decode
  };
};
