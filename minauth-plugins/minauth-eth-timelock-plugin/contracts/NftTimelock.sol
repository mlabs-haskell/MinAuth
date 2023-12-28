// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract ERC721TimeLock {
    uint256 public constant HASH_BIT_SIZE = 256; // Example size for the hash

    event TokenLocked(address indexed user, address indexed tokenAddress, uint256 tokenId, uint256 unlockTime, bytes32 hash);
    event TokenUnlocked(address indexed user, address indexed tokenAddress, uint256 tokenId, bytes32 hash);

    struct LockedToken {
        address tokenAddress;
        uint256 tokenId;
        uint256 unlockTime;
        bytes32 hash;
    }

    mapping(address => LockedToken[]) public lockedTokens;

    function lockToken(address _tokenAddress, uint256 _tokenId, uint256 _lockPeriod, bytes32 _hash) external {
        require(_lockPeriod > 0, "Lock period must be greater than 0");
        require(_hash > 0, "Hash must be non-zero"); // Additional validation for hash

        // Check if the token exists by calling ownerOf
        address tokenOwner = IERC721(_tokenAddress).ownerOf(_tokenId);
        require(tokenOwner != address(0), "ERC721: operator query for nonexistent token");


        uint256 unlockTime = block.timestamp + _lockPeriod;
        IERC721(_tokenAddress).transferFrom(msg.sender, address(this), _tokenId);

        lockedTokens[msg.sender].push(LockedToken({
            tokenAddress: _tokenAddress,
            tokenId: _tokenId,
            unlockTime: unlockTime,
            hash: _hash
        }));

        emit TokenLocked(msg.sender, _tokenAddress, _tokenId, unlockTime, _hash);
    }

    function unlockToken(uint256 _index) external {
        require(_index < lockedTokens[msg.sender].length, "Invalid index");

        LockedToken memory tokenInfo = lockedTokens[msg.sender][_index];
        require(block.timestamp >= tokenInfo.unlockTime, "Token is still locked");

        _removeLockedToken(msg.sender, _index);
        IERC721(tokenInfo.tokenAddress).transferFrom(address(this), msg.sender, tokenInfo.tokenId);

        emit TokenUnlocked(msg.sender, tokenInfo.tokenAddress, tokenInfo.tokenId, tokenInfo.hash);
    }

    function _removeLockedToken(address _user, uint256 _index) private {
       require(_index < lockedTokens[_user].length, "Invalid index");

        lockedTokens[_user][_index] = lockedTokens[_user][lockedTokens[_user].length - 1];
        lockedTokens[_user].pop();
    }

    // Function to query locked tokens and their statuses for a user
    function getLockedTokens(address _user) external view returns (LockedToken[] memory) {
        return lockedTokens[_user];
    }
}
