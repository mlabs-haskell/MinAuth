import Erc721TimelockPlugin from '../src/plugin';
import Erc721TimelockProver from '../src/prover';
import { pluginTestPair } from './common';

describe('EthTimelockPlugin - Proof Submission and Verification', () => {
  let plugin: Erc721TimelockPlugin;
  let prover: Erc721TimelockProver;

  beforeAll(async () => {
    const { plugin: pl, prover: pr } = await pluginTestPair(10);
    plugin = pl;
    prover = pr;
  });

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
  });
});
