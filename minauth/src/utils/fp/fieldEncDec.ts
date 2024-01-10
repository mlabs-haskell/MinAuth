import { Field } from 'o1js';
import { EncodeDecoder, wrapZodDec } from '../../plugin/encodedecoder.js';
import { FpInterfaceType } from '../../plugin/interfacekind.js';
import { pipe } from 'fp-ts/lib/function.js';
import { z } from 'zod';
import * as E from 'fp-ts/lib/Either.js';
import { safeFromString } from './either.js';

/**
 * Encode/decode an o1js Field. (to string)
 */
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
