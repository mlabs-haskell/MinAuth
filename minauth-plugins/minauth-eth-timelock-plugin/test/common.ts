import { Program } from '../src/merkle-membership-program.js';
import { Erc721TimelockPlugin } from '../src/plugin.js';
import { Erc721TimelockProver } from '../src/prover.js';
import { Cache } from 'o1js';
import { MockErc721TimeLock } from './eth-contract-mock.js';
import { log } from './logger.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { Logger } from 'minauth/dist/plugin/logger.js';

let verificationKey: VerificationKey | null = null;

export const pluginTestPair = async (n: number, logger?: Logger) => {
  if (verificationKey === null) {
    verificationKey = (
      await Program.compile({
        cache: Cache.None
      })
    ).verificationKey;
  }

  const erc721timelock = new MockErc721TimeLock(n, undefined, logger);

  const configuration = {
    timeLockContractAddress: '0x00000000',
    erc721ContractAddress: '0x00000000',
    ethereumJsonRpcProvider: 'http://127.0.0.1:8545'
  };

  return {
    plugin: new Erc721TimelockPlugin(
      erc721timelock,
      verificationKey,
      configuration,
      log
    ),
    prover: new Erc721TimelockProver(log, erc721timelock)
  };
};
