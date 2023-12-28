// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract SimpleStorage {
    uint public validity;
    mapping(address => uint) public blockNumbers;

    // Event declaration
    event AddressRegistered(address indexed user, uint blockNumber);

    constructor(uint _validity) {
        validity = _validity;
    }

    function register() public {
        blockNumbers[msg.sender] = block.number + validity;
        emit AddressRegistered(msg.sender, block.number + validity);
    }
}

