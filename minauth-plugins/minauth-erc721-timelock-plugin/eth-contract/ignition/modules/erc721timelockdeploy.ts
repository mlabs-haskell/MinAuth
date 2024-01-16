import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const defaultLockPeriod = 180;

export default buildModule("ERC721TimeLockDeployment", (m) => {
// Deploy ERC721TimeLock contract
// Replace '3600' with your desired lock period

  const lockPeriod = m.getParameter("lock-period", defaultLockPeriod);
  const erc721TimeLock = m.contract("ERC721TimeLock", [lockPeriod]);

  // Additional deployment logic can be added here if needed
  // For example, if your contract requires initialization calls

  return { erc721TimeLock };
});
