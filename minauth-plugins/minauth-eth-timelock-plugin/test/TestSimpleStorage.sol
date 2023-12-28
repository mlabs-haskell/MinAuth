// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/SimpleStorage.sol";

contract TestSimpleStorage {
    uint public initialBlockNumber;
    SimpleStorage simpleStorage = SimpleStorage(DeployedAddresses.SimpleStorage());

    uint validity = 10;

    function beforeEach() public {
        initialBlockNumber = block.number;
    }

    function testItRegistersAddressAndBlockNumber() public {
        simpleStorage.register();
        uint expectedBlockNumber = initialBlockNumber + validity;
        uint actualBlockNumber = simpleStorage.blockNumbers(address(this));

        Assert.isAtLeast(actualBlockNumber, expectedBlockNumber, "It should register the address with the correct block number.");
    }

    // Additional tests as needed...
}
