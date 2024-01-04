import { JsonProof } from 'o1js';
import { mkUserSecret, userCommitmentHex } from '../src/commitment-types';
import Erc721TimelockPlugin from '../src/plugin';
import Erc721TimelockProver from '../src/prover';
import { pluginTestPair } from './common.js';
import { ILogObj, Logger } from 'tslog';
import { describe, expect, beforeEach, test } from '@jest/globals';

const log = new Logger<ILogObj>({
  name: 'Tests: Erc721TimelockPlugin - Proof Submission and Verification'
});

describe('EthTimelockPlugin - Proof Submission and Verification', () => {
  let plugin: Erc721TimelockPlugin;
  let prover: Erc721TimelockProver;

  beforeEach(async () => {
    const { plugin: pl, prover: pr } = await pluginTestPair(10, log);
    plugin = pl;
    prover = pr;
  }, 60000);

  test('should verify a valid proof', async () => {
    // Assuming a method to generate a valid proof
    // the mock used for the erc721 lock contract
    // installs as commitments poseidon hashes of the
    // 0..9 range
    // So we expect that a proof for the is valid
    const proof = await prover.buildInputAndProve({ secret: '0' });
    const output = await plugin.verifyAndGetOutput({}, proof);

    expect(output).toBeDefined();
    // Add more assertions based on expected output structure
  }, 30000);

  test('should fail to build proof for an unexistent commitment', async () => {
    // Assuming a method to generate an invalid proof
    // the mock used for the erc721 lock contract
    // installs as commitments poseidon hashes of the
    // 0..9 range
    // So we expect that a proof for the is valid
    const secret = { secret: '10' };
    const commitmentHex = userCommitmentHex(mkUserSecret(secret)).commitmentHex;

    expect(await prover.buildInputAndProve({ secret: '10' })).toThrow(
      `Could not build the witness for the commitment ${commitmentHex}`
    );
  }, 3000);

  test('should fail verify if merkle tree changes', async () => {
    // Assuming a method to generate an invalid proof
    // the mock used for the erc721 lock contract
    // installs as commitments poseidon hashes of the
    // 0..9 range
    // So we expect that a proof for the is valid
    const secret = { secret: '0' };
    const newCommitment = { commitmentHex: '0x12345678' };
    const proof = await prover.buildInputAndProve(secret);
    expect(await plugin.verifyAndGetOutput({}, proof)).toBeDefined();
    plugin.ethContract.lockToken(0, newCommitment);
    expect(await plugin.verifyAndGetOutput({}, proof)).toThrow();
  }, 30000);

  test('should fail verify if the proof is tampered with', async () => {
    // Assuming a method to generate an invalid proof
    // the mock used for the erc721 lock contract
    // installs as commitments poseidon hashes of the
    // 0..9 range
    // So we expect that a proof for the is valid
    const secret = { secret: '0' };
    const proof: JsonProof = await prover.buildInputAndProve(secret);

    // Tamper with the proof
    const newProof: JsonProof = {
      proof: changeOneBit(proof.proof),
      publicInput: proof.publicInput,
      publicOutput: proof.publicOutput,
      maxProofsVerified: proof.maxProofsVerified
    };

    expect(await plugin.verifyAndGetOutput({}, proof)).toBeDefined();
    expect(await plugin.verifyAndGetOutput({}, newProof)).toThrow();
  }, 3000);
});

function changeOneBit(input: string): string {
  if (input.length === 0) {
    throw new Error('Input string is empty');
  }

  // Convert the first character to its ASCII value
  let charCode = input.charCodeAt(0);

  // Flip the least significant bit (LSB)
  charCode ^= 1;

  // Replace the first character with the modified one
  return String.fromCharCode(charCode) + input.slice(1);
}
