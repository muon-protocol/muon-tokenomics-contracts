import { ethers, upgrades } from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("MuonDelegatorRewards");
  const contract = await upgrades.deployProxy(Factory, [
    "0x60CfED01ce2804988F9BDf966B1E396c25Ca9B64",
    "0xf8A987dE88117AD4DFEcD462988B47d4dC7f24E0",
    "1743930714",
    "0x131759470cA68A3d88bD14b5A68f35178349048F",
    "0xB081F939b92896b2faFc9b6CFa20E71c04DD247f"
    // "0x60CfED01ce2804988F9BDf966B1E396c25Ca9B64",
    // "0xbEE653E392b93349969d37665F13890D90A34055",
    // "33954509096405560968900518376958303499181158920639861973580852701353346797081",
    // {
    //   x: "0x60d24ba781e8cb6242ea6865d515c50a098be1052878a604a90613fd0d3712dc",
    //   parity: 1,
    // },
    // "0xf8A987dE88117AD4DFEcD462988B47d4dC7f24E0",
    // 0,
    // 0,
    // 0,
    // 0,
    // 0,
    // 0
  ]);
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
}

// async function main() {

//   const factory = await ethers.getContractFactory("SchnorrSECP256K1VerifierV2");

//   const contract = await factory.deploy();

//   await contract.deployed();

//   console.log("Contract deployed to:", contract.address);
// }


main().catch((error) => {
  console.error(error);
  process.exit(1);
});