import { Field } from 'o1js';
import { EncodeDecoder } from '../plugin/encodedecoder';
import { TsInterfaceType } from '../plugin/interfacekind';
import { z } from 'zod';

export const VerificationKeySchema = z.object({
  data: z.string(),
  hash: z.string()
});

export type VerificationKey = {
  data: string;
  hash: Field;
};

export const verificationKey: EncodeDecoder<TsInterfaceType, VerificationKey> =
  {
    __interface_tag: 'ts',

    decode: (i: unknown) => {
      try {
        const vk = VerificationKeySchema.parse(i);
        return { data: vk.data, hash: Field.from(vk.hash) };
      } catch {
        return undefined;
      }
    },

    encode: (i: VerificationKey) => ({ data: i.data, hash: i.hash.toString() })
  };
