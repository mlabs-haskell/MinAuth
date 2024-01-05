import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ignition-ethers';
import dotenv from 'dotenv';

const env = dotenv.config().parsed;
if (!env) {
  throw new Error('No .env file found');
}
const ALCHEMY_API_KEY = env.ALCHEMY_API_KEY;
const SEPOLIA_PRIVATE_KEY = env.SEPOLIA_PRIVATE_KEY;
const ETHERSCAN_API_KEY = env.ETHERSCAN_API_KEY;

const config: HardhatUserConfig = {
  solidity: '0.8.20',
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY]
    }
  }
};

export default config;
