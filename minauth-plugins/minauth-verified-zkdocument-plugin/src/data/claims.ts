import {Struct, Provable, Field} from "o1js"
import {z} from "zod"
import {FieldsSchema} from "./simple.js"

const CLAIMS_MAX_SIZE = 128;

export function Claims(n: number) {
  if (n > CLAIMS_MAX_SIZE) {
    throw new Error(`Claims size ${n} exceeds the maximum size ${CLAIMS_MAX_SIZE}`);
  }

  class Claims_ extends Struct({
    packed: Provable.Array(Field, n),
  }) {
    static MAX_SIZE = CLAIMS_MAX_SIZE;

    public toFields() {
      return this.packed;
    }

    static get schema() {
      return z.object({
        packed: FieldsSchema.length(n)
      }).transform((o) => new Claims_({ packed: o.packed }));
    }

    public claim(r :{firstFieldIx: number, lastFieldIx: number }): Field[] {
      return this.packed.slice(r.firstFieldIx, r.lastFieldIx+1);
    }
  }

  return Claims_;
}
