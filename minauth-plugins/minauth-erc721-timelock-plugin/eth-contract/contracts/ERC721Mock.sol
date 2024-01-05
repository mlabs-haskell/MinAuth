// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC721Mock
 * @dev Mock contract for ERC721
 * This mock contract provides basic functionalities for testing,
 * including minting tokens, which is not part of the ERC721 standard.
 */
contract ERC721Mock is ERC721 {
    // Token ID counter for minting new tokens
    uint256 private _tokenIdCounter;

    /**
     * @dev Constructor that sets the name and symbol of the token.
     * @param name Name of the token.
     * @param symbol Symbol of the token.
     */
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    /**
     * @dev Function to mint a new token.
     * @param to Address to receive the minted token.
     * @return tokenId The token ID of the minted token.
     */
    function mint(address to) public returns (uint256) {
        _tokenIdCounter += 1;
        uint256 newTokenId = _tokenIdCounter;
        _mint(to, newTokenId);
        return newTokenId;
    }
}
