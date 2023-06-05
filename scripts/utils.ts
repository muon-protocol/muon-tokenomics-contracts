import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { PION, BondedPION } from "../typechain-types";

export const MAX_UINT = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export async function deploy(treasury: string) {
  const [PION, bondedPION] = await Promise.all([
    ethers.getContractFactory("PION"),
    ethers.getContractFactory("BondedPION"),
  ]);

  const pion = (await upgrades.deployProxy(PION, [])) as PION;
  const bonPion = (await upgrades.deployProxy(bondedPION, [
    pion.address,
    treasury,
  ])) as BondedPION;

  return {
    pion,
    bonPion,
  };
}

export async function testDeployLocally() {
  const signers = await ethers.getSigners();
  const treasury = signers[signers.length - 1].address;

  const contracts = await deploy(treasury);

  return {
    ...contracts,
    treasury,
  };
}

export async function deployTestToken() {
  const TestToken = await ethers.getContractFactory("TestToken");
  const token = await TestToken.deploy();
  await token.deployTransaction.wait();
  await token.deployed();
  return token;
}
