import {
  commitmentFieldToHex,
  commitmentHexToField,
  mkUserSecret,
  SECRET_MAX_LENGTH,
  UserCommitmentField,
  UserCommitmentHex,
  UserSecretInput,
} from "../src/commitment-types";
import { describe, expect, it } from "@jest/globals";
import { Field } from "o1js";

describe("mkUserSecret Tests", () => {
  it("should create a valid secret hash from a normal string", () => {
    const input: UserSecretInput = { secret: "normalString" };
    const result = mkUserSecret(input);
    expect(result.secretHash).toBeDefined();
  });

  it("should handle an empty string input", () => {
    const input: UserSecretInput = { secret: "" };
    const result = mkUserSecret(input);
    expect(result.secretHash).toBeDefined();
  });

  it("should handle a long string input", () => {
    const longString = "a".repeat(SECRET_MAX_LENGTH); // Example of a long string
    const input: UserSecretInput = { secret: longString };
    const result = mkUserSecret(input);
    expect(result.secretHash).toBeDefined();
  });

  it("should throw on too long string input", () => {
    const longString = "a".repeat(SECRET_MAX_LENGTH+1); // Example of a long string
    const input: UserSecretInput = { secret: longString };
    expect(() => mkUserSecret(input)).toThrow();
  });

  it("should handle a string with special characters", () => {
    const specialString = "!@#$%^&*()_+";
    const input: UserSecretInput = { secret: specialString };
    const result = mkUserSecret(input);
    expect(result.secretHash).toBeDefined();
  });
});
describe("commitmentHexToField and commitmentFieldToHex Tests", () => {
it('converts a valid hex string to a field correctly', () => {
  const hexInput: UserCommitmentHex = { commitmentHex: '0x1a2b3c' };
  const result = commitmentHexToField(hexInput);
  expect(result).toHaveProperty('commitment');
  expect(result.commitment).toBeInstanceOf(Field);
  expect(BigInt(result.commitment.toString())).toBe(BigInt('0x1a2b3c'));
});

it('handles hex string without 0x prefix', () => {
  const hexInput: UserCommitmentHex = { commitmentHex: '1a2b3c' };
  const result = commitmentHexToField(hexInput);
  expect(result).toHaveProperty('commitment');
  expect(BigInt(result.commitment.toString()).toString(16)).toBe('1a2b3c'); // Check if '0x' is correctly prepended
});


// Test for invalid hex string
it('throws an error for invalid hex string', () => {
  const hexInput: UserCommitmentHex = { commitmentHex: 'invalidHex' };
  expect(() => commitmentHexToField(hexInput)).toThrow(); // Assuming your function throws an error for invalid input
});
  it("composition of commitmentHexToField and commitmentFieldToHex is identity", () => {
    const originalInput: UserCommitmentHex = { commitmentHex: "0x123abc" };
    const fieldResult = commitmentHexToField(originalInput);
    const hexResult = commitmentFieldToHex(fieldResult);
    expect(hexResult.commitmentHex).toEqual(originalInput.commitmentHex);
  });
  it('composition of commitmentFieldToHex and commitmentHexToField is identity', () => {
    const originalFieldInput: UserCommitmentField = { commitment: new Field(123) };
    const hexResult = commitmentFieldToHex(originalFieldInput);
    const fieldResult = commitmentHexToField(hexResult);
    expect(fieldResult).toEqual(originalFieldInput); // Adjust this according to how equality is defined for your Field type
  });

});
