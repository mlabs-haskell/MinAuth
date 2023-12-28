import Web3 from 'web3';
import TruffleContract from '@truffle/contract';
import SimpleStorageArtifact from './build/contracts/SimpleStorage.json';

export class SimpleStorageAPI {
  private web3: Web3;
  private SimpleStorage: TruffleContract;
  private contractInstance: any;

  constructor(provider: Web3) {
    this.web3 = provider;
    this.SimpleStorage = TruffleContract(SimpleStorageArtifact);
    this.SimpleStorage.setProvider(this.web3.currentProvider);
  }

  async init(): Promise<void> {
    try {
      this.contractInstance = await this.SimpleStorage.deployed();
    } catch (error) {
      console.error('Error initializing contract:', error);
    }
  }

  async registerAddress(): Promise<void> {
    try {
      const accounts = await this.web3.eth.getAccounts();
      await this.contractInstance.register({ from: accounts[0] });
      console.log('Address registered:', accounts[0]);
    } catch (error) {
      console.error('Error registering address:', error);
    }
  }

  async isAddressValid(address: string): Promise<boolean> {
    try {
      const currentBlock = await this.web3.eth.getBlockNumber();
      const registeredBlock = await this.contractInstance.blockNumbers(address);
      return registeredBlock.toNumber() >= currentBlock;
    } catch (error) {
      console.error('Error checking address validity:', error);
      return false;
    }
  }

  // Additional functions as needed...
}
