const SimpleStorage = artifacts.require('SimpleStorage');

contract('SimpleStorage', (accounts) => {
  let simpleStorageInstance;

  before(async () => {
    simpleStorageInstance = await SimpleStorage.deployed();
  });

  it('should register an address with the correct block number', async () => {
    const validity = 10; // Assuming this is the value of validity you used in your constructor
    await simpleStorageInstance.register({ from: accounts[0] });
    const currentBlock = await web3.eth.getBlockNumber();

    const storedBlockNumber = await simpleStorageInstance.blockNumbers(
      accounts[0]
    );
    assert.equal(
      storedBlockNumber.toNumber(),
      currentBlock + validity,
      'The block number should be current block number + validity.'
    );
  });

  // Additional tests as needed...
});
