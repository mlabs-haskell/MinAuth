import {
  InterfaceKind,
  WithInterfaceTag,
  TsInterfaceType,
  FpInterfaceType,
  ChooseType
} from './interfaceKind';
import { Either } from 'fp-ts/Either';
import * as E from 'fp-ts/Either';
import * as z from 'zod';

export interface Decoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  decode: (
    _: unknown
  ) => ChooseType<InterfaceType, Either<string, T>, T | undefined>;
}

export const tsToFpDecoder = <T>(
  tsDec: Decoder<TsInterfaceType, T>
): Decoder<FpInterfaceType, T> => {
  return {
    __interface_tag: 'fp',
    decode: (i) => E.fromNullable('unable to parse')(tsDec.decode(i))
  };
};

export interface Encoder<InterfaceType extends InterfaceKind, T>
  extends WithInterfaceTag<InterfaceType> {
  // Encoding should never failed. The returned value should be able to
  // serialize using `JSON.stringify`.
  encode: (_: T) => unknown;
}

export const tsToFpEncoder = <T>(
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

  return (i === 'fp' ? fpDec : tsDec) as Decoder<InterfaceType, T>;
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
