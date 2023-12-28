// for later
const Web3 = require('web3');
let web3;

if (window.ethereum) {
  web3 = new Web3(window.ethereum);
  try {
    // Request account access if needed
    await window.ethereum.enable();
  } catch (error) {
    console.error('User denied account access');
  }
} else if (window.web3) {
  // Legacy dapp browsers...
  web3 = new Web3(window.web3.currentProvider);
} else {
  console.log(
    'Non-Ethereum browser detected. You should consider trying MetaMask!'
  );
}
