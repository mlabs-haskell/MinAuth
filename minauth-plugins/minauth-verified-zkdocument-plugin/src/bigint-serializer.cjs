module.exports = {
  test(value) {
    return typeof value === 'bigint';
  },
  print(value) {
    return `BigInt(${value.toString()})`;
  },
};

