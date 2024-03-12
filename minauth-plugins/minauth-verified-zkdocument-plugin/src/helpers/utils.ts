import { Field } from 'o1js';

export const ftn = (fld: Field) => Number(fld.toBigInt());

export  function arraysAreEqual<T>(array1: T[], array2: T[]): boolean {
    if (array1.length !== array2.length) {
      return false;
    }

    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) {
        return false;
      }
    }

    return true;
  }
