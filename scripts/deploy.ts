import { ethers, upgrades } from "hardhat";

export const treasury = "0x786bd69517Bc30eE2fC13FeDA8B1aE0e6feDbad6";
export const initialTokenAmount = ethers.utils.parseEther("10000000");
const token_name = "PION"

async function main() {
  // Get Token and signer
  const Token = await ethers.getContractFactory(token_name);
  const signer = (await ethers.getSigners())[0];

  // Deploy the Token
  console.log("Deploying Token...");
  const token = await upgrades.deployProxy(Token, [], { signer });
  await token.deployed();
  console.log("Token deployed to:", token.address);
  await token.mint(signer.address, initialTokenAmount);
  console.log("Mint", initialTokenAmount.toString(), "Token for", signer.address);

  // Get BondedToken
  const BondedToken = await ethers.getContractFactory(`Bonded${token_name}`);

  // Deploy the BondedToken
  console.log("Deploying BondedToken...");
  const bonTokenArgs = [token.address, treasury];
  const bonToken = await upgrades.deployProxy(BondedToken, bonTokenArgs, {
    signer,
  });
  await bonToken.deployed();
  console.log("BondedToken deployed to:", bonToken.address);

  // Verify the Token
  console.log("Verifying Token on Etherscan...");
  await hre.run("verify:verify", {
    address: token.address,
    constructorArguments: [],
  });
  console.log("Token verified on Etherscan!");

  // Verify the BondedToken on Etherscan
  console.log("Verifying BondedToken on Etherscan...");
  await hre.run("verify:verify", {
    address: bonToken.address,
    constructorArguments: [],
  });
  console.log("BondedToken verified on Etherscan!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
