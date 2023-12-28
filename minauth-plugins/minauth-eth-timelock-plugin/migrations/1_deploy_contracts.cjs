const ERC721TimeLock = artifacts.require('ERC721TimeLock');

module.exports = function (deployer) {
  const lock_period = 60; // 60 seconds
  deployer.deploy(ERC721TimeLock, lock_period);
};
