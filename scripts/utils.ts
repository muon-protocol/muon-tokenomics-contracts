import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { PION, BondedPION, Minter } from "../typechain-types";

export const MAX_UINT = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export async function deployBondedPION(treasury: string) {
  const [PION, BondedPION] = await Promise.all([
    ethers.getContractFactory("PION"),
    ethers.getContractFactory("BondedPION"),
  ]);

  const pion = (await upgrades.deployProxy(PION, [])) as PION;
  const bonPion = (await upgrades.deployProxy(BondedPION, [
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

  const contracts = await deployBondedPION(treasury);

  return {
    ...contracts,
    treasury,
  };
}

export async function deployMinter() {
  const signers = await ethers.getSigners();
  const staking = signers[signers.length - 1];
  const ONE_DAY = 24 * 60 * 60;

  const [PION, Minter] = await Promise.all([
    ethers.getContractFactory("PION"),
    ethers.getContractFactory("Minter"),
  ]);

  const pion = (await upgrades.deployProxy(PION, [])) as PION;
  const minter = (await upgrades.deployProxy(Minter, [
    pion.address,
    staking.address,
    ONE_DAY,
    ethers.utils.parseEther("100"),
  ])) as Minter;

  return {
    pion,
    minter,
    staking,
  };
}

export async function deployPION() {
  const [PION] = await Promise.all([ethers.getContractFactory("PION")]);

  const pion = (await upgrades.deployProxy(PION, [])) as PION;

  return {
    pion,
  };
}

export async function deployTestToken() {
  const TestToken = await ethers.getContractFactory("TestToken");
  const token = await TestToken.deploy();
  await token.deployTransaction.wait();
  await token.deployed();
  return token;
}
