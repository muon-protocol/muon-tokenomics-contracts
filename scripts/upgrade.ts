import { ethers, upgrades } from "hardhat";

async function main() {
  const CONTRACT_ADDRESS = "";
  const Factory = await ethers.getContractFactory("MuonDelegatorRewards");
  const contract = await upgrades.upgradeProxy(CONTRACT_ADDRESS, Factory);
  console.log(`Contract upgraded to ${contract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });