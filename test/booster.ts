import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, ContractReceipt, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import UNISWAP_V2_PAIR_ABI from "@uniswap/v2-core/build/UniswapV2Pair.json";

import { PIONtest, BondedPION, Booster, TestToken } from "../typechain-types";
import axios from "axios";

const getDummySig = async (
    wallet: string
  ) => {
    const response = await axios.get(
      `https://pion-price.muon.net/api/price/${wallet}`
    );
    return response.data;
  };

describe("Booster", function () {
  const ONE = ethers.utils.parseEther("1");

  let deployer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;
  let user: SignerWithAddress;
  let nftId1: number;
  let nftId2: number;
  let nftId3: number;

  let pion: PIONtest;
  let bondedPion: BondedPION;
  let booster: Booster;
  let boostValue: BigNumber
  let usdc: TestToken;
  let uniswapV2Pair: MockContract;

  const mintBondedPion = async (
    pionAmount: BigNumberish,
    _to: SignerWithAddress
  ) => {
    await pion.connect(deployer).mint(_to.address, pionAmount);
    await pion.connect(_to).approve(bondedPion.address, pionAmount);

    const tx = await bondedPion
      .connect(_to)
      .mintAndLock([pion.address], [pionAmount], _to.address);

    const receipt: ContractReceipt = await tx.wait();
    let tokenId;
    if (receipt.events) {
      const event = receipt.events[0];
      tokenId = event.args?.tokenId.toNumber();
    }
    return tokenId;
  };

  before(async () => {
    [deployer, treasury, staker1, staker2, user] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const PIONtest = await ethers.getContractFactory("PIONtest");
    pion = (await upgrades.deployProxy(PIONtest, [])) as PIONtest;
    await pion.deployed();

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = (await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
    ])) as BondedPION;
    await bondedPion.deployed();

    nftId1 = await mintBondedPion(ONE.mul(100), staker1);
    nftId2 = await mintBondedPion(ONE.mul(200), staker2);
    nftId3 = await mintBondedPion(ONE.mul(200), staker1);

    usdc = (await ethers.deployContract("TestToken")) as TestToken;

    await usdc.connect(staker1).mint(staker1.address, ONE.mul(800));
    await usdc.connect(staker2).mint(staker2.address, ONE.mul(300));

    uniswapV2Pair = await deployMockContract(deployer, UNISWAP_V2_PAIR_ABI.abi);

    const Booster = await ethers.getContractFactory("Booster");
    booster = await Booster.connect(deployer).deploy(
      pion.address,
      usdc.address,
      bondedPion.address,
      treasury.address,
      uniswapV2Pair.address,
      ONE.mul(2),
      "0xF28bAdc5CBcE790fF10EB9567FD9f2223C473C21" // signer
    );
    await booster.deployed();
    boostValue = await booster.boostValue()


    await pion
      .connect(deployer)
      .grantRole(await pion.MINTER_ROLE(), booster.address);
    await bondedPion
      .connect(deployer)
      .grantRole(await bondedPion.BOOSTER_ROLE(), booster.address);

    await usdc.connect(staker1).approve(booster.address, ONE.mul(1000));
    await usdc.connect(staker2).approve(booster.address, ONE.mul(1000));

    await uniswapV2Pair.mock.getReserves.returns(
      ONE.mul(10),
      ONE.mul(10),
      "1695796719"
    );
    await uniswapV2Pair.mock.token0.returns(usdc.address);
    
  });

  describe("Boost", async function () {
    it("Should boost the staker bondedPion", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);
      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(0));
      const pionSupplyBeforeBoost = await pion.totalSupply();


      let oracleData = await getDummySig(staker1.address);
      await booster.connect(staker1).boost(nftId1, ONE.mul(100),
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(0));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(0));
      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(100));
      expect(await pion.totalSupply()).eq(pionSupplyBeforeBoost);
    });

    it("Should not boost with amount 0", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);
      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(0));

      await expect(
        booster.connect(staker1).boost(nftId1, 0,
          ONE.mul(1),
          Math.floor(new Date().getTime() / 1000).toString(),
          "0x00"
        )
      ).to.be.revertedWith("0 amount");
    });

    it("Should not allow double boosting", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);
      expect(await usdc.balanceOf(booster.address)).eq(ONE.mul(0));

      let oracleData = await getDummySig(staker1.address);
      await booster.connect(staker1).boost(nftId1, ONE.mul(100),
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(100));

      oracleData = await getDummySig(staker1.address);
      await expect(
        booster.connect(staker1).boost(nftId1, ONE.mul(100),
          oracleData.amount,
          oracleData.timestamp,
          oracleData.signature
        )
      ).to.be.revertedWith("> boostableAmount");
    });

    it("Should decrease the boostableAmount after boosting", async function () {
      expect(await booster.getBoostableAmount(nftId1)).eq(ONE.mul(100));

      let oracleData = await getDummySig(staker1.address);
      await booster.connect(staker1).boost(nftId1, ONE.mul(60),
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      const signedPrice = BigNumber.from(oracleData.amount)
      const muonAmount = ONE.mul(60).mul(signedPrice).div(ONE)
      const boostedBalance = muonAmount.mul(boostValue).div(ONE)
      const newLockAmount = boostedBalance.add(ONE.mul(100)) 

      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([newLockAmount]);
      expect(await bondedPion.boostedBalance(nftId1)).eq(muonAmount.add(boostedBalance));
      expect(await booster.getBoostableAmount(nftId1)).eq(
        newLockAmount.sub(muonAmount.add(boostedBalance))
      );
    });

    it("Should increase the boostableAmount after buying extra Pion from market", async function () {
      expect(await booster.getBoostableAmount(nftId1)).eq(ONE.mul(100));

      let oracleData = await getDummySig(staker1.address);
      await booster.connect(staker1).boost(nftId1, ONE.mul(100),
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      const signedPrice = BigNumber.from(oracleData.amount)
      const muonAmount = ONE.mul(100).mul(signedPrice).div(ONE)
      const boostedBalance = muonAmount.mul(boostValue).div(ONE)
      const newLockAmount = boostedBalance.add(ONE.mul(100))
      let boostableAmount = ONE.mul(0)
      if(muonAmount.add(boostedBalance) < newLockAmount){
        boostableAmount = newLockAmount.sub(muonAmount.add(boostedBalance))
      }

      expect(await booster.getBoostableAmount(nftId1)).eq(
        boostableAmount
      );
      expect(await bondedPion.boostedBalance(nftId1)).eq(
        muonAmount.add(boostedBalance)
      );

      await pion.connect(deployer).mint(staker1.address, ONE.mul(100));
      await pion.connect(staker1).approve(bondedPion.address, ONE.mul(100));
      await bondedPion
        .connect(staker1)
        .lock(nftId1, [pion.address], [ONE.mul(100)]);

      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100).add(newLockAmount)]);
      expect(await booster.getBoostableAmount(nftId1)).eq(ONE.mul(100).add(
        newLockAmount).sub(muonAmount.add(boostedBalance))
      );
    });
  });
  describe("Create and Boost", async function () {
    it("Should create and boost", async function () {
      let oracleData = await getDummySig(staker2.address);
      await usdc.connect(deployer).mint(staker2.address, ONE.mul(100));
      await pion.connect(deployer).mint(staker2.address, ONE.mul(100));

      await usdc.connect(staker2).approve(booster.address, ONE.mul(100));
      await pion.connect(staker2).approve(booster.address, ONE.mul(100));

      const pionTotalSupply = await pion.totalSupply();

      const nftId = await booster
        .connect(staker2)
        .callStatic.createAndBoost(ONE.mul(100), ONE.mul(100),
          oracleData.amount,
          oracleData.timestamp,
          oracleData.signature
        );
      await expect(
        booster.connect(staker2).createAndBoost(ONE.mul(100), ONE.mul(100),
          oracleData.amount,
          oracleData.timestamp,
          oracleData.signature
        )
      ).not.to.be.reverted;

      const signedPrice = BigNumber.from(oracleData.amount)
      const muonAmount = ONE.mul(100).mul(signedPrice).div(ONE)
      const boostedBalance = muonAmount.mul(boostValue).div(ONE)

      expect(nftId).eq(4);
      expect(await bondedPion.ownerOf(nftId)).eq(staker2.address);
      expect(await bondedPion.getLockedOf(nftId, [pion.address])).to.deep.equal(
        [ONE.mul(100).add(boostedBalance)]
      );
      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(100));

      // bosted pion should be burned
      expect(await pion.totalSupply()).eq(pionTotalSupply.sub(ONE.mul(100)));
    });

    it("Should not create and boost with muonAmount 0", async function () {
      await usdc.connect(deployer).mint(staker2.address, ONE.mul(100));
      await pion.connect(deployer).mint(staker2.address, ONE.mul(100));

      await usdc.connect(staker2).approve(booster.address, ONE.mul(100));
      await pion.connect(staker2).approve(booster.address, ONE.mul(100));

      await expect(
        booster.connect(staker2).createAndBoost(0, ONE.mul(100), 
          ONE.mul(1),
          Math.floor(new Date().getTime() / 1000).toString(),
          "0x00"
        )
      ).to.be.rejectedWith("0 amount");
    });

    it("Should not create and boost with usdcAmount 0", async function () {
      await usdc.connect(deployer).mint(staker2.address, ONE.mul(100));
      await pion.connect(deployer).mint(staker2.address, ONE.mul(100));

      await usdc.connect(staker2).approve(booster.address, ONE.mul(100));
      await pion.connect(staker2).approve(booster.address, ONE.mul(100));

      await expect(
        booster.connect(staker2).createAndBoost(ONE.mul(100), 0,
          ONE.mul(1),
          Math.floor(new Date().getTime() / 1000).toString(),
          "0x00"
        )
      ).to.be.rejectedWith("0 amount");
    });
  });

  describe("Owner operations", async function () {
    it("Should allow the owner withdraw the PION tokens", async function () {
      await pion.connect(deployer).mint(booster.address, ONE.mul(100000));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(deployer.address)).eq(0);

      await expect(
        booster
          .connect(deployer)
          .adminWithdraw(ONE.mul(1000), deployer.address, pion.address)
      ).to.not.be.reverted;

      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000 - 1000));
      expect(await pion.balanceOf(deployer.address)).eq(ONE.mul(1000));
    });

    it("Should not allow the owner withdraw and send to address 0", async function () {
      const zeroAddress = ethers.constants.AddressZero;
      await pion.connect(deployer).mint(booster.address, ONE.mul(100000));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(deployer.address)).eq(0);

      await expect(
        booster
          .connect(deployer)
          .adminWithdraw(ONE.mul(70), zeroAddress, pion.address)
      ).to.be.reverted;
    });

    it("Should not allow NON-OWNER withdraw the PION tokens", async function () {
      await pion.connect(deployer).mint(booster.address, ONE.mul(100000));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(user.address)).eq(0);

      const revertMSG = "Ownable: caller is not the owner"

      await expect(
        booster
          .connect(user)
          .adminWithdraw(ONE.mul(100), user.address, pion.address)
      ).to.be.revertedWith(revertMSG);

      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(user.address)).eq(0);
    });

    it("Should allow the owner set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await booster.connect(deployer).setBoostValue(ONE.mul(3));

      expect(await booster.boostValue()).eq(ONE.mul(3));
    });

    it("Should not allow the NON-OWNER set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await expect(booster.connect(user).setBoostValue(ONE.mul(3))).to.be
        .reverted;

      expect(await booster.boostValue()).eq(ONE.mul(2));
    });

    it("Should allow the owner set treasury", async function () {
      expect(await booster.treasury()).eq(treasury.address);

      let newTreasury: SignerWithAddress;
      [newTreasury] = await ethers.getSigners();

      await booster.connect(deployer).setTreasury(newTreasury.address);

      expect(await booster.treasury()).eq(newTreasury.address);
    });

    it("Should not allow the owner set treasury to address 0", async function () {
      const zeroAddress = ethers.constants.AddressZero;

      expect(await booster.treasury()).eq(treasury.address);

      await expect(
        booster.connect(deployer).setTreasury(zeroAddress)
      ).to.be.revertedWith("0x0 treasury");
    });

    it("Should not allow the NON-OWNER set treasury", async function () {
      expect(await booster.treasury()).eq(treasury.address);

      let newTreasury: SignerWithAddress;
      [newTreasury] = await ethers.getSigners();

      await expect(booster.connect(user).setTreasury(newTreasury.address)).to.be
        .reverted;

      expect(await booster.treasury()).eq(treasury.address);
    });
  });

  describe("Merge", async function () {
    it("Should aggregate boostable amount of 2 NFTs upon merging them", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);

      expect(
        await bondedPion.getLockedOf(nftId3, [pion.address])
      ).to.deep.equal([ONE.mul(200)]);

      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(0));
      
      let oracleData = await getDummySig(staker1.address);
      await booster.connect(deployer).setSignatureValidityPeriod(1000)
      await booster.connect(staker1).boost(nftId1, ONE.mul(100), 
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      const signedPrice = BigNumber.from(oracleData.amount)
      let muonAmount = ONE.mul(100).mul(signedPrice).div(ONE)
      let boostedBalance = muonAmount.mul(boostValue).div(ONE)
      let newLockAmount = boostedBalance.add(ONE.mul(100))
      let boostableAmount = ONE.mul(0)
      if(muonAmount.add(boostedBalance) < newLockAmount){
        boostableAmount = newLockAmount.sub(muonAmount.add(boostedBalance))
      }

      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([newLockAmount]);
      const boostedBalanceNFT1 = muonAmount.add(boostedBalance)
      expect(await bondedPion.boostedBalance(nftId1)).eq(boostedBalanceNFT1);
      expect(await booster.getBoostableAmount(nftId1)).eq(boostableAmount);
      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(100));

      await booster.connect(staker1).boost(nftId3, ONE.mul(150), 
        oracleData.amount,
        oracleData.timestamp,
        oracleData.signature
      );

      muonAmount = ONE.mul(150).mul(signedPrice).div(ONE)
      boostedBalance = muonAmount.mul(boostValue).div(ONE)
      newLockAmount = boostedBalance.add(ONE.mul(200))
      boostableAmount = ONE.mul(0)
      if(muonAmount.add(boostedBalance) < newLockAmount){
        boostableAmount = newLockAmount.sub(muonAmount.add(boostedBalance))
      }

      expect(
        await bondedPion.getLockedOf(nftId3, [pion.address])
      ).to.deep.equal([newLockAmount]);
      const boostedBalanceNFT2 = muonAmount.add(boostedBalance)
      expect(await bondedPion.boostedBalance(nftId3)).eq(boostedBalanceNFT2);
      expect(await booster.getBoostableAmount(nftId3)).eq(boostableAmount);
      expect(await usdc.balanceOf(treasury.address)).eq(ONE.mul(250));

      await bondedPion.connect(staker1).merge(nftId1, nftId3);

      expect(await bondedPion.boostedBalance(nftId3)).eq(boostedBalanceNFT1.add(boostedBalanceNFT2));
    });
  });
});
