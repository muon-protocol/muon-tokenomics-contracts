import { ethers, upgrades } from "hardhat";

async function main() {
  const v1Address = "0x92Eb5e9d97B9fCC8657b03FbeA8805cfc5368668";
  const contractV1 = await ethers.getContractFactory("MuonDelegatorRewardsV2");

  const MuonDelegatorRewards = await ethers.getContractFactory("MuonDelegatorRewards");

  await upgrades.forceImport(
    v1Address,
    contractV1,
  );

  const contractV2 = await upgrades.upgradeProxy(v1Address, MuonDelegatorRewards);

  console.log("MuonDelegatorRewards upgraded to:", contractV2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });