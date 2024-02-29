import { Field, ZkProgram, Poseidon, CircuitString, Struct, Provable } from 'o1js';


// TODO extend so that the programs are wrapped in to zkclaim class that can explain
// what is being claimed to the user and more
// how to check the validity of the claim etc
// TODO base them on numberClaims.ts reuse ciircuit but change the
// wrappers to be more convenient etc

export const mkClaimTimestampGreaterThan = (index: number) => {

  if (index < 0) {
    throw new Error('index must be non-negative');
  }

  const prog = ZkProgram({
    name: 'IntegerIsGreaterThan',
    publicInput: Field,
    publicOutput: Field,

    methods: {
      baseCase: {
        privateInputs: [CircuitString],
        method(publicInput: Field, secretInput: CircuitString) {
          const fields = secretInput.toFields();
          const thenumber = fields[index];
          thenumber.assertGreaterThan(publicInput);
          const inputHash = Poseidon.hash(fields);
          return inputHash;
        }
      }
    }
  });

  return prog;
}

export const mkClaimTimestampIsLessThan = (index: number) => {

  if (index < 0) {
    throw new Error('index must be non-negative');
  }

  const prog = ZkProgram({
    name: 'TimestampIsLessThan',
    publicInput: Field,
    publicOutput: Field,

    methods: {
      baseCase: {
        privateInputs: [CircuitString],
        method(publicInput: Field, secretInput: CircuitString) {
          const fields = secretInput.toFields();
          const thenumber = fields[index];
          thenumber.assertLessThan(publicInput);
          const inputHash = Poseidon.hash(fields);
          return inputHash;
        }
      }
    }
  });

  return prog;
}


export const mkClaimTimestampIsEqualTo = (index: number) => {

  if (index < 0) {
    throw new Error('index must be non-negative');
  }

  const prog = ZkProgram({
    name: 'TimestampIsEqualTo',
    publicInput: Field,
    publicOutput: Field,

    methods: {
      baseCase: {
        privateInputs: [CircuitString],
        method(publicInput: Field, secretInput: CircuitString) {
          const fields = secretInput.toFields();
          const thenumber = fields[index];
          thenumber.assertEquals(publicInput);
          const inputHash = Poseidon.hash(fields);
          return inputHash;
        }
      }
    }
  });

  return prog;
}

export class Range extends Struct({
  min: Field,
  minInclusive: Field,
  max: Field,
  maxInclusive: Field,
}) {}

export const mkClaimTimestampIsBetween = (index: number) => {

  if (index < 0) {
    throw new Error('index must be non-negative');
  }

  const prog = ZkProgram({
    name: 'TimestampIsInBetween',
    publicInput: Range,
    publicOutput: Field,

    methods: {
      baseCase: {
        privateInputs: [CircuitString],
        method(range: Range, secretInput: CircuitString) {
          const fields = secretInput.toFields();
          const thenumber = fields[index];

          const min = Provable.if(range.minInclusive.equals(new Field(0)), range.min.add(new Field(1)), range.min);
          const max = Provable.if(range.maxInclusive.equals(new Field(0)), range.max.sub(new Field(1)), range.max);

          thenumber.assertGreaterThanOrEqual(min);
          thenumber.assertLessThanOrEqual(max);

          const inputHash = Poseidon.hash(fields);
          return inputHash;
        }
      }
    }
  });

  return prog;
}
