import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import UNISWAP_V2_ROUTER_ABI from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import UNISWAP_V2_PAIR_ABI from "@uniswap/v2-core/build/UniswapV2Pair.json";

import { PIONtest, BondedPION, Booster, TestToken } from "../typechain-types";

describe("Booster", function () {
  const ONE = ethers.utils.parseEther("1");

  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let daoRole: SignerWithAddress;
  let treasury: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;
  let user: SignerWithAddress;
  let nftId1: number;
  let nftId2: number;

  let pion: PIONtest;
  let bondedPion: BondedPION;
  let booster: Booster;
  let usdc: TestToken;
  let uniswapV2Router: MockContract;
  let uniswapV2Pair: MockContract;

  const mintBondedPion = async (pionAmount: BigNumberish, _to: SignerWithAddress) => {
    await pion.connect(deployer).mint(_to.address, pionAmount);
    await pion.connect(_to).approve(bondedPion.address, pionAmount);

    const tx = await bondedPion
    .connect(_to)
    .mintAndLock(
      [pion.address],
      [pionAmount],
      _to.address
    );

    const receipt: ContractReceipt = await tx.wait();
    let tokenId;
    if(receipt.events) {
      const event = receipt.events[0];
      tokenId = event.args?.tokenId.toNumber();
    }
    return tokenId;
  };

  before(async () => {
    [
      deployer,
      admin,
      daoRole,
      treasury,
      staker1,
      staker2,
      user,
    ] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const PIONtest = await ethers.getContractFactory("PIONtest");
    pion = await upgrades.deployProxy(PIONtest, []) as PIONtest;
    await pion.deployed();

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
    ]) as BondedPION;
    await bondedPion.deployed();

    nftId1 = await mintBondedPion(ONE.mul(100), staker1);
    nftId2 = await mintBondedPion(ONE.mul(200), staker2);

    usdc = await ethers.deployContract("TestToken") as TestToken;

    await usdc.connect(staker1).mint(staker1.address, ONE.mul(200));
    await usdc.connect(staker2).mint(staker2.address, ONE.mul(200));

    uniswapV2Router = await deployMockContract(deployer, UNISWAP_V2_ROUTER_ABI.abi);
    uniswapV2Pair = await deployMockContract(deployer, UNISWAP_V2_PAIR_ABI.abi);

    const BoosterFactory = await ethers.getContractFactory("Booster");
    booster = await upgrades.deployProxy(BoosterFactory, [
      pion.address,
      usdc.address,
      bondedPion.address,
      treasury.address,
      uniswapV2Router.address,
      uniswapV2Pair.address,
      ONE.mul(2)
    ]) as Booster;
    await booster.deployed();

    await booster.connect(deployer).grantRole(booster.ADMIN_ROLE(), admin.address);
    await booster.connect(deployer).grantRole(booster.DAO_ROLE(), daoRole.address);

    await pion.connect(deployer).grantRole(await pion.MINTER_ROLE(), booster.address);
    await bondedPion.connect(deployer).grantRole(await bondedPion.BOOSTER_ROLE(), booster.address);

    await usdc.connect(staker1).approve(booster.address, ONE.mul(1000));    
    await usdc.connect(staker2).approve(booster.address, ONE.mul(1000));

    await uniswapV2Pair.mock.getReserves.returns(ONE.mul(10), ONE.mul(10), '1695796719');
    await uniswapV2Pair.mock.token0.returns(usdc.address);
    await uniswapV2Router.mock.addLiquidity.returns(ONE.mul(100), ONE.mul(100), ONE.mul(10));

  });

  describe("boost", async function() {
    it("Should boost the staker bonPion", async function () {
      expect(await bondedPion.getLockedOf(nftId1, [pion.address])).to.deep.equal([
        ONE.mul(100),
      ]);
      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(0));

      await booster.connect(staker1).boost(nftId1, ONE.mul(100));

      expect(await bondedPion.getLockedOf(nftId1, [pion.address])).to.deep.equal([
        ONE.mul(300),
      ]);
      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(100));
    });

    it("Should allow the ADMIN withdraw the USDC tokens", async function () {
      await booster.connect(staker1).boost(nftId1, ONE.mul(100));

      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(100));
      expect(await usdc.balanceOf(admin.address)).eq(0);

      await booster.connect(admin).adminWithdraw(
        ONE.mul(70), 
        admin.address, 
        usdc.address
      );

      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(30));
      expect(await usdc.balanceOf(admin.address)).eq(ONE.mul(70));
    });

    it("Should not allow NON-ADMIN withdraw the USDC tokens", async function () {
      await booster.connect(staker1).boost(nftId1, ONE.mul(100));

      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(100));
      expect(await usdc.balanceOf(user.address)).eq(0);
      
      await expect(booster.connect(user).adminWithdraw(
        ONE.mul(100), 
        user.address, 
        usdc.address
      )).to.be.reverted;

      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(100));
      expect(await usdc.balanceOf(user.address)).eq(0);
    });

    it("Should allow the DAO set treasury", async function () {
      expect(await booster.treasury()).eq(treasury.address);

      let newTreasury: SignerWithAddress;
      [ newTreasury ] = await ethers.getSigners()

      await booster.connect(daoRole).setTreasury(newTreasury.address);

      expect(await booster.treasury()).eq(newTreasury.address);
    });

    it("Should not allow the NON-DAO set treasury", async function () {
      expect(await booster.treasury()).eq(treasury.address);

      let newTreasury: SignerWithAddress;
      [ newTreasury ] = await ethers.getSigners()

      await expect(booster.connect(user).setTreasury(newTreasury.address)).to.be.reverted;

      expect(await booster.treasury()).eq(treasury.address);
    });

    it("Should allow the ADMIN set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await booster.connect(admin).setBoostValue(ONE.mul(3));

      expect(await booster.boostValue()).eq(ONE.mul(3));
    });

    it("Should not allow the NON-ADMIN set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await expect(booster.connect(user).setBoostValue(ONE.mul(3))).to.be.reverted;

      expect(await booster.boostValue()).eq(ONE.mul(2));
    });

  });
});