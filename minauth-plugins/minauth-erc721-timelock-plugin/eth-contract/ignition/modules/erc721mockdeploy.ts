import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ERC721MockDeployment", (m) => {
  const name = m.getParameter("name", "DefaultName");
  const symbol = m.getParameter("symbol", "DN");

  const erc721Mock = m.contract("ERC721Mock", [name, symbol]);

  return { erc721Mock };
});
