const BigIntSerializer = {
  test(val: unknown) {
    return typeof val === 'bigint';
  },
  serialize(val: bigint) {
    return val.toString() + 'n'; // Append 'n' to indicate BigInt
  }
};

export default BigIntSerializer;
