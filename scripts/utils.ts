import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { PION, BondedPION, Minter } from "../typechain-types";

export const MAX_UINT = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export async function deployBondedToken(treasury: string, token_name: string) {
  const [Token, BondedToken] = await Promise.all([
    ethers.getContractFactory(token_name),
    ethers.getContractFactory(`Bonded${token_name}`),
  ]);

  const token = (await upgrades.deployProxy(Token, [])) as Token;
  const bonToken = (await upgrades.deployProxy(BondedToken, [
    token.address,
    treasury,
  ])) as BondedToken;

  return {
    token,
    bonToken,
  };
}

export async function PionTestDeployLocally() {
  const signers = await ethers.getSigners();
  const treasury = signers[signers.length - 1].address;

  const contracts = await deployBondedToken(treasury, "PION");

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
