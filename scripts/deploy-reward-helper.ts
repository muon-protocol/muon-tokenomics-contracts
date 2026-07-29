import { ethers, run } from "hardhat";

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {

  const args = [
    "0x41499392Dd084f1eAC22d90869d9a1b3BD9DfA84",
    "0x46f0Be64a51a3da1bF0627403679CBda2F9aB7af",
    "5000000000000000000000000"
  ]

  const contract = await ethers.deployContract("RewardHelper", args);

  await contract.deployed();

  console.log(
    `contract deployed to ${contract.address}`
  );
  
  await sleep(10000);

  await run("verify:verify", {
    address: contract.address,
    constructorArguments: args
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
