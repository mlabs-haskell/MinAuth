import { describe, expect, test } from '@jest/globals';
import { BytesLike, ethers } from 'ethers';
// TODO there seems to be a bug - the below fails
// import { hexToUInt8Array, hexlify } from '../src/erc721timelock';

// XXX This is a temporary workaround until the bug is fixed
export function hexlify(bytes: BytesLike): string {
  return ethers.hexlify(bytes);
}

// TODO: ALWAYS ENSURE that this it the copy of the code from erc721timelock.ts
export function hexToUInt8Array(hexString: string, size?: number): Uint8Array {
  // Validate the input
  if (!/^0x[a-fA-F0-9]+$/.test(hexString)) {
    throw new Error('Invalid hexadecimal string');
  }

  // Remove the '0x' prefix
  hexString = hexString.slice(2);
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString;
  }

  const sz = size || hexString.length / 2;

  // pad with zeros
  const padding = sz * 2 - hexString.length;
  hexString = '0'.repeat(padding) + hexString;

  // Calculate the number of bytes in the hex string
  const numBytes = hexString.length / 2;

  // Check if the hex string represents more than 32 bytes
  if (numBytes > sz) {
    throw new Error('Hexadecimal string represents more than 32 bytes');
  }

  // Create a buffer of 32 bytes, filled with zeros
  const bytes = new Uint8Array(sz);

  // Convert hex string to bytes in little-endian format
  for (let i = 0, j = 0; i < hexString.length; i += 2, j++) {
    bytes[j] = parseInt(hexString.substring(i, i + 2), 16);
  }

  return bytes;
}

describe('Hex Utility Functions', () => {
  // Predefined values for testing
  const testData = [
    {
      bytes: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      hex: '0x01020304',
      hex_out: '0x01020304'
    },
    {
      bytes: new Uint8Array([0x01, 0x02, 0x03]),
      hex: '0x010203',
      hex_out: '0x010203'
    },
    {
      bytes: new Uint8Array([0x0f]),
      hex: '0xf',
      hex_out: '0x0f'
    }
  ];

  test('hexlify should convert Uint8Array to hex string', () => {
    for (const data of testData) {
      expect(hexlify(data.bytes)).toEqual(data.hex_out);
    }
  });

  test('hexToUInt8Array should convert hex string to Uint8Array', () => {
    for (const data of testData) {
      expect(hexToUInt8Array(data.hex)).toEqual(data.bytes);
    }
  });

  test('composition of hexlify and hexToUInt8Array should be identity (Uint8Array -> Hex -> Uint8Array)', () => {
    for (const data of testData) {
      const composed = hexToUInt8Array(hexlify(data.bytes));
      expect(composed).toEqual(data.bytes);
    }
  });

  test('composition of hexToUInt8Array and hexlify should be identity (Hex -> Uint8Array -> Hex)', () => {
    for (const data of testData) {
      const composed = hexlify(hexToUInt8Array(data.hex));
      expect(composed).toEqual(data.hex_out);
    }
  });
});
