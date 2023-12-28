import { Field } from 'o1js';
import { EncodeDecoder, wrapZodDec } from '../../plugin/encodedecoder';
import { FpInterfaceType } from '../../plugin/interfacekind';
import { pipe } from 'fp-ts/lib/function';
import { z } from 'zod';
import * as E from 'fp-ts/lib/Either.js';
import { safeFromString } from './either';

export const fieldEncDec: EncodeDecoder<FpInterfaceType, Field> = {
  __interface_tag: 'fp',

  decode: (i: unknown) =>
    pipe(
      wrapZodDec('fp', z.string()).decode(i),
      E.chain(
        safeFromString(Field.from, (err) => `failed to decode Field: ${err}`)
      )
    ),

  encode: (i: Field) => i.toString()
};
