import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contracts } from '../typechain-types/factories';

// Main test suite for the ERC721TimeLock contract
describe('ERC721TimeLock', function () {
  // Fixture for deploying the contract and related setup.
  // This function is used to avoid repetitive setup code in each test case.

  // Helper function to deploy the fixture and lock a token
  async function deployERC721TimeLockFixture() {
    const LOCK_PERIOD = 30 * 24 * 60 * 60;
    const [owner, otherAccount] = await ethers.getSigners();

    const erc721Mock = await new contracts.ERC721Mock__factory(owner).deploy(
      'TestToken',
      'TTK'
    );

    const erc721MockReceipt = await erc721Mock.deploymentTransaction()?.wait(1);
    if (!erc721MockReceipt) {
      throw new Error('Could not get ERC721Mock receipt');
    }

    const erc721TimeLock = await new contracts.ERC721TimeLock__factory(
      owner
    ).deploy(LOCK_PERIOD);

    const erc721TimeLockReceipt = await erc721TimeLock
      .deploymentTransaction()
      ?.wait(1);
    if (!erc721TimeLockReceipt) {
      throw new Error('Could not get ERC721TimeLock receipt');
    }

    if (!erc721MockReceipt.contractAddress) {
      throw new Error('Could not get ERC721Mock address');
    }
    const erc721MockAddress: string = erc721MockReceipt.contractAddress;

    if (!erc721TimeLockReceipt.contractAddress) {
      throw new Error('Could not get ERC721TimeLock address');
    }
    const erc721TimeLockAddress: string = erc721TimeLockReceipt.contractAddress;

    return {
      erc721TimeLock,
      erc721TimeLockReceipt,
      erc721MockAddress,
      erc721Mock,
      erc721MockReceipt,
      erc721TimeLockAddress,
      owner,
      otherAccount,
      LOCK_PERIOD
    };
  }

  async function deployAndLockToken() {
    const fixture = await deployERC721TimeLockFixture();

    // Mint a token to the owner
    await fixture.erc721Mock.mint(fixture.owner.address);
    const tokenId = 1; // Assuming the minting starts from 1 and increments

    // Approve the ERC721TimeLock contract to transfer the token on behalf of the owner
    await fixture.erc721Mock
      .connect(fixture.owner)
      .approve(fixture.erc721TimeLockAddress, tokenId);

    // Generate a hash for locking the token
    const hash = ethers.keccak256('0x1234');

    // Lock the token using the ERC721TimeLock contract
    await fixture.erc721TimeLock.lockToken(
      fixture.erc721MockAddress,
      tokenId,
      hash
    );

    // Return the necessary details from the fixture
    return { ...fixture, tokenId, hash };
  }

  // Test suite for deployment-related tests
  describe('Deployment', function () {
    it('Should set the right lockPeriod', async function () {
      const { erc721TimeLock, LOCK_PERIOD } =
        await deployERC721TimeLockFixture();
      expect(await erc721TimeLock.lockPeriod()).to.equal(LOCK_PERIOD);
    });
  });

  // Test suite for token locking functionality
  describe('Locking Tokens', function () {
    it('Should lock a token correctly and emit the correct event', async function () {
      const {
        erc721TimeLock,
        erc721TimeLockAddress,
        erc721Mock,
        erc721MockAddress,
        owner,
        LOCK_PERIOD
      } = await loadFixture(deployERC721TimeLockFixture);

      // Mint a token and approve
      await erc721Mock.mint(owner.address);
      const tokenId = 1; // Assuming minting starts from 1 and increments
      await erc721Mock.approve(erc721TimeLockAddress, tokenId);

      // Correct hash calculation
      const hash = ethers.keccak256('0x1234');
      const tx = await erc721TimeLock.lockToken(
        erc721MockAddress,
        tokenId,
        hash
      );

      // Check event emission
      await expect(tx)
        .to.emit(erc721TimeLock, 'TokenLocked')
        .withArgs(owner.address, erc721MockAddress, tokenId, anyValue, hash);

      // Verify lock details
      const lockedToken = await erc721TimeLock.lockedTokens(owner.address, 0);
      expect(lockedToken.tokenAddress).to.equal(erc721MockAddress);
      expect(lockedToken.tokenId).to.equal(tokenId);

      // Timestamp comparison
      const currentBlock = await ethers.provider.getBlock('latest');
      if (!currentBlock) {
        throw new Error('Could not get latest block');
      }
      expect(lockedToken.unlockTime).to.be.closeTo(
        currentBlock.timestamp + LOCK_PERIOD,
        5
      );
      expect(lockedToken.hash).to.equal(hash);
    });

    // not necessary - ERC721 will prohibit approvals of non-existent tokens
    it('Should prohibit locking non-existent tokens', async function () {
      const {
        // erc721TimeLock,
        erc721TimeLockAddress,
        erc721Mock
        // , erc721MockAddress
      } = await loadFixture(deployERC721TimeLockFixture);
      const nonExistentTokenId = 9999;
      // const hash = ethers.keccak256('0x1234');
      // this will fail always
      await expect(
        erc721Mock.approve(erc721TimeLockAddress, nonExistentTokenId)
      )
        .to.be.revertedWithCustomError(erc721Mock, 'ERC721NonexistentToken')
        .withArgs(9999);

      // await expect(
      //   erc721TimeLock.lockToken(erc721MockAddress, nonExistentTokenId, hash)
      // ).to.be.revertedWith('ERC721NonexistentToken(9999)');
    });

    // not necessary - ERC721 will prohibit approvals of non-existent tokens
    it('Should fail to lock a token by a non-owner', async function () {
      const {
        // erc721TimeLock,
        erc721TimeLockAddress,
        erc721Mock,
        // erc721MockAddress,
        owner,
        otherAccount
      } = await deployERC721TimeLockFixture();
      const tokenId = 1;
      await erc721Mock.mint(owner.address);

      // this will fail always
      await expect(
        erc721Mock.connect(otherAccount).approve(erc721TimeLockAddress, tokenId)
      )
        .to.be.revertedWithCustomError(erc721Mock, 'ERC721InvalidApprover')
        .withArgs(`${otherAccount.address}`);
      // await expect(
      //   erc721TimeLock
      //     .connect(otherAccount)
      //     .lockToken(erc721MockAddress, tokenId, ethers.keccak256('0x1234'))
      // ).to.be.revertedWith(); // Replace with actual error message
    });

    // Add more tests here if necessary
  });

  // Test suite for token unlocking functionality
  describe('Unlocking Tokens', function () {
    it('Should unlock a token after the lock period', async function () {
      const {
        erc721TimeLockAddress,
        erc721TimeLock,
        erc721MockAddress,
        erc721Mock,
        owner,
        LOCK_PERIOD
      } = await deployERC721TimeLockFixture();
      const tokenId = 1;
      await erc721Mock.mint(owner.address);
      await erc721Mock.approve(erc721TimeLockAddress, tokenId);
      const hash = ethers.keccak256('0x1234');
      await erc721TimeLock.lockToken(erc721MockAddress, tokenId, hash);

      await ethers.provider.send('evm_increaseTime', [LOCK_PERIOD]);
      await ethers.provider.send('evm_mine', []);

      const tx = await erc721TimeLock.unlockToken(0);
      await expect(tx)
        .to.emit(erc721TimeLock, 'TokenUnlocked')
        .withArgs(owner.address, erc721MockAddress, tokenId, anyValue);
      expect(await erc721Mock.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should fail to unlock a token if still in the lock period', async function () {
      const { erc721TimeLock, erc721Mock, owner } =
        await deployERC721TimeLockFixture();
      const tokenId = 1;
      await erc721Mock.mint(owner.address);
      await erc721Mock.approve(erc721TimeLock, tokenId);
      const hash = ethers.keccak256('0x1234');
      await erc721TimeLock.lockToken(erc721Mock, tokenId, hash);

      await expect(erc721TimeLock.unlockToken(0)).to.be.revertedWith(
        'Token is still locked'
      );
      const lockedToken = await erc721TimeLock.lockedTokens(owner.address, 0);
      expect(lockedToken.unlockTime).to.be.greaterThan(
        (await ethers.provider.getBlock('latest'))?.timestamp
      );
    });

    it('Should fail to re-lock an already locked token', async function () {
      const { erc721TimeLock, erc721Mock, erc721MockAddress, tokenId, hash } =
        await deployAndLockToken();
      await expect(
        erc721TimeLock.lockToken(erc721MockAddress, tokenId, hash)
      ).to.be.revertedWithCustomError(erc721Mock, 'ERC721IncorrectOwner');
    });

    it('Should fail to unlock a token by a non-owner', async function () {
      const {
        erc721TimeLock,
        erc721TimeLockAddress,
        erc721MockAddress,
        erc721Mock,
        owner,
        otherAccount,
        LOCK_PERIOD
      } = await deployERC721TimeLockFixture();
      const tokenId = 1;
      await erc721Mock.mint(owner.address);
      await erc721Mock.approve(erc721TimeLockAddress, tokenId);
      await erc721TimeLock.lockToken(
        erc721MockAddress,
        tokenId,
        ethers.keccak256('0x1234')
      );

      await ethers.provider.send('evm_increaseTime', [LOCK_PERIOD]);
      await ethers.provider.send('evm_mine', []);

      await expect(
        erc721TimeLock.connect(otherAccount).unlockToken(0)
      ).to.be.revertedWith('Invalid index'); // Replace with actual error message
    });

    it('Should not allow standard transfer of locked token', async function () {
      const {
        erc721TimeLockAddress,
        erc721TimeLock,
        erc721Mock,
        erc721MockAddress,
        owner,
        otherAccount
      } = await loadFixture(deployERC721TimeLockFixture);
      const tokenId = 1;
      await erc721Mock.mint(owner.address);
      await erc721Mock.connect(owner).approve(erc721TimeLockAddress, tokenId);
      const hash = ethers.keccak256('0x1234');
      await erc721TimeLock.lockToken(erc721MockAddress, tokenId, hash);

      // Attempt to transfer the locked token
      await expect(
        erc721Mock
          .connect(owner)
          .transferFrom(owner.address, otherAccount.address, tokenId)
      ).to.be.revertedWithCustomError(erc721Mock, 'ERC721InsufficientApproval');
    });

    // Add more tests here if necessary
  });
});
