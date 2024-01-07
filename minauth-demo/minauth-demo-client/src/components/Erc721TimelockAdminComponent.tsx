import React, { useEffect, useState } from 'react';
import { UserCommitmentHexSchema } from 'minauth-erc721-timelock-plugin/dist/commitment-types.js';
import { Erc721TimelockAdminComponentProps } from './minauth-prover-component2';



export const Erc721TimelockAdminComponent = ({ prover, logger }: Erc721TimelockAdminComponentProps) => {
  const [lockContractAddress, setLockContractAddress] = useState('');
  const [nftContractAddress, setNftContractAddress] = useState('');
  const [tokenIdToLock, setTokenIdToLock] = useState('');
  const [commitmentData, setCommitmentData] = useState('');
  const [tokenIdToUnlock, setTokenIdToUnlock] = useState('');
  const [transactionInfo, setTransactionInfo] = useState('');

  useEffect(() => {
    async function fetchContractAddresses() {
      try {
        setNftContractAddress(prover.erc721ContractAddress);
      } catch (error) {
        console.error('Error fetching contract addresses:', error);
      }
    }

    if (prover) {
      fetchContractAddresses();
    }
  }, [prover]);

  const handleLockNFT = async () => {
    try {
      const commitment = UserCommitmentHexSchema.parse(commitmentData);
      await prover.lockNft(commitment, parseInt(tokenIdToLock, 10));
      setTransactionInfo('NFT Locked successfully');
    } catch (error) {
      console.error('Error locking NFT:', error);
      setTransactionInfo('Error locking NFT');
    }
  };

  const handleUnlockNFT = async () => {
    try {
      await prover.unlockNft(parseInt(tokenIdToUnlock, 10));
      setTransactionInfo('NFT Unlocked successfully');
    } catch (error) {
      console.error('Error unlocking NFT:', error);
      setTransactionInfo('Error unlocking NFT');
    }
  };

  return (
    <div>
      <div>
        <strong>Ethereum Provider:</strong> {prover?.ethereumProvider}
      </div>
      <div>
        <strong>Lock Contract Address:</strong> {lockContractAddress}
      </div>
      <div>
        <strong>NFT Contract Address:</strong> {nftContractAddress}
      </div>
      <div>
        <input
          type="text"
          value={commitmentData}
          onChange={(e) => setCommitmentData(e.target.value)}
          placeholder="Enter Commitment Data" />
        <input
          type="number"
          value={tokenIdToLock}
          onChange={(e) => setTokenIdToLock(e.target.value)}
          placeholder="Enter Token ID to lock" />
        <button onClick={handleLockNFT}>Lock NFT</button>
      </div>
      <div>
        <input
          type="number"
          value={tokenIdToUnlock}
          onChange={(e) => setTokenIdToUnlock(e.target.value)}
          placeholder="Enter Token ID to unlock" />
        <button onClick={handleUnlockNFT}>Unlock NFT</button>
      </div>
      {transactionInfo && <div>{transactionInfo}</div>}
    </div>
  );
};
