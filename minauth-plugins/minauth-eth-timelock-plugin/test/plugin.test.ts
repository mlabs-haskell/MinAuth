import { JsonProof } from 'o1js';
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
    // Assuming a method to generate an invalid proof
    // the mock used for the erc721 lock contract
    // installs as commitments poseidon hashes of the
    // 0..9 range
    // So we expect that a proof for the is valid

    const { plugin: pl, prover: pr } = await pluginTestPair(10, log);
    plugin = pl;
    prover = pr;
  }, 60000);

  test('should verify a valid proof', async () => {
    const proof = await prover.buildInputAndProve({ secret: '0' });
    const output = await plugin.verifyAndGetOutput({}, proof);

    expect(output).toBeDefined();
    // Add more assertions based on expected output structure
  }, 30000);

  test('should fail to build proof for an unexistent commitment', async () => {
    await expect(prover.buildInputAndProve({ secret: '10' })).rejects.toThrow();
  }, 30000);

  test('should fail verify if merkle tree changes', async () => {
    const secret = { secret: '0' };
    const newCommitment = { commitmentHex: '0x12345678' };
    const proof: JsonProof = await prover.buildInputAndProve(secret);
    expect(await plugin.verifyAndGetOutput({}, proof)).toBeDefined();
    await plugin.ethContract.lockToken(0, newCommitment);
    await expect(plugin.verifyAndGetOutput({}, proof)).rejects.toThrow();
  }, 30000);

  test('should fail verify if the proof is tampered with', async () => {
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
    await expect(plugin.verifyAndGetOutput({}, newProof)).rejects.toThrow();
  }, 30000);

  test('Should validate correct output', async () => {
    const secret = { secret: '0' };
    const proof: JsonProof = await prover.buildInputAndProve(secret);
    const output = await plugin.verifyAndGetOutput({}, proof);

    const outputValid = await plugin.checkOutputValidity(output);

    expect(outputValid.isValid).toEqual(true);
  }, 30000);

  test('Should not validate incorrect output ', async () => {
    const secret = { secret: '0' };
    const proof: JsonProof = await prover.buildInputAndProve(secret);

    const output = await plugin.verifyAndGetOutput({}, proof);

    const newCommitment = { commitmentHex: '0x12345678' };
    await plugin.ethContract.lockToken(0, newCommitment);
    let outputValid = await plugin.checkOutputValidity(output);
    expect(outputValid.isValid).toEqual(false);

    await plugin.ethContract.unlockToken(0);

    outputValid = await plugin.checkOutputValidity(output);
    expect(outputValid.isValid).toEqual(true);
  }, 30000);
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
