import { MockErc721TimeLock } from '../test/eth-contract-mock'; // Adjust the import path as necessary

describe('MockErc721TimeLock', () => {
  let mockContract: MockErc721TimeLock;
  const initialCommitmentCount = 5;

  beforeEach(() => {
    mockContract = new MockErc721TimeLock(initialCommitmentCount);
  });

  test('initial state should have correct number of commitments', async () => {
    const { commitments } = await mockContract.fetchEligibleCommitments();
    expect(commitments.length).toBe(initialCommitmentCount);
  });

  test('locking a token should add a commitment', async () => {
    const newHash = '0x123';
    await mockContract.lockToken(123, newHash);

    const { commitments } = await mockContract.fetchEligibleCommitments();
    expect(commitments).toContain(newHash);
    expect(commitments.length).toBe(initialCommitmentCount + 1);
  });

  test('unlocking a token should remove the corresponding commitment', async () => {
    const newHash = '0x123';
    await mockContract.lockToken(456, newHash); // Lock a token first
    await mockContract.unlockToken(0);

    const { commitments } = await mockContract.fetchEligibleCommitments();
    expect(commitments.length).toBe(initialCommitmentCount + 1 - 1); // One added, one removed
    expect(commitments).not.toContain(newHash);
  });

  test('unlocking a token with invalid index should throw an error', async () => {
    const invalidIndex = initialCommitmentCount + 1; // Out of range index
    await expect(mockContract.unlockToken(invalidIndex)).rejects.toThrow(
      'Invalid index for unlockToken'
    );
  });

  // Additional tests can be added as needed
});
