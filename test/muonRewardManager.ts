import { ethers, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import axios from "axios";

import { MuonRewardManager, PIONtest, BondedPION } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MuonRewardManager", function () {
  const ONE = ethers.utils.parseEther("1");

  const rewardRole = "0x3E15aEAE0414B0400f29B41fc9e12e2CBa08e8d5";
  const dummyServer = "https://alice-test.muon.net/reward-server/rewardsTest";

  let deployer: SignerWithAddress;
  let claimer1: SignerWithAddress;
  let claimer2: SignerWithAddress;
  let treasury: SignerWithAddress;

  let rewardManager: MuonRewardManager;
  let pion: PIONtest;
  let bondedPion: BondedPION;

  before(async () => {
    [deployer, claimer1, claimer2, treasury] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
    const PIONtest = await ethers.getContractFactory("PIONtest");
    pion = await upgrades.deployProxy(PIONtest, []) as PIONtest;
    await pion.deployed();

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
    ]) as BondedPION;
    await bondedPion.deployed();

    const MuonRewardManager = await ethers.getContractFactory("MuonRewardManager");
    rewardManager = await MuonRewardManager.connect(deployer).deploy(
      pion.address,
      bondedPion.address,
      rewardRole
    );
    await rewardManager.deployed();

    await pion.connect(deployer).grantRole(
      await pion.MINTER_ROLE(),
      rewardManager.address
    );
  });

  const getDummySig = async (claimer: SignerWithAddress) => {
    const data = {
      claimer: claimer.address,
    };
    return axios
      .post(dummyServer, data)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.error("An error occurred:", error);
        throw error;
      });
  };

  describe("Claim Reward", function () {
    it("Should allow to claim rewards using reward server signature", async function () {
      const resp = await getDummySig(claimer1);

      const rewardManagerBeforeBalance = await pion.balanceOf(
        rewardManager.address
      );

      const tx = await rewardManager
        .connect(claimer1)
        .claimReward(resp.result.total_reward_e18, resp.result.signature);
      const receipt = await tx.wait();
      let tokenId = 0;
      if(receipt.events) {
        tokenId = receipt.events[receipt.events.length - 1].args?.tokenId.toNumber();
      }
      expect(tokenId).eq(1);

      const lockeds = await bondedPion.getLockedOf(tokenId, [pion.address]);
      expect(lockeds[0]).eq(resp.result.total_reward_e18);

      // const rewardManagerAfterBalance = await pion.balanceOf(
      //   rewardManager.address
      // );

      // expect(rewardManagerAfterBalance).eq(
      //   BigInt(rewardManagerBeforeBalance) -
      //     BigInt(resp.result.total_reward_e18)
      // );

      // Duplicate request
      await expect(
        rewardManager
          .connect(claimer1)
          .claimReward(resp.result.total_reward_e18, resp.result.signature)
      ).to.be.revertedWith("Already claimed the reward.");
    });

    it("Should prevent other accounts from using claimers' signature", async function () {
      const resp = await getDummySig(claimer1);
      await expect(
        rewardManager
          .connect(claimer2)
          .claimReward(resp.result.total_reward_e18, resp.result.signature)
      ).to.be.revertedWith("Invalid signature.");
    });

    it("Should prevent using the fake signature to claim the reward", async function() {
      rewardManager.connect(deployer).setSigner(deployer.address);
      const resp = await getDummySig(claimer1);
      await expect(
        rewardManager
          .connect(claimer1)
          .claimReward(resp.result.total_reward_e18, resp.result.signature)
      ).to.be.revertedWith("Invalid signature.");
    });

    it("Claimed rewards should be burned", async function() {
      const resp = await getDummySig(claimer1);
      
      const tx = await rewardManager
          .connect(claimer1)
          .claimReward(resp.result.total_reward_e18, resp.result.signature);
      const receipt = await tx.wait();
      let tokenId = 0;
      if(receipt.events) {
        tokenId = receipt.events[receipt.events.length - 1].args?.tokenId.toNumber();
      }
      expect(tokenId).eq(1);

      const lockeds = await bondedPion.getLockedOf(tokenId, [pion.address]);
      expect(lockeds[0]).eq(resp.result.total_reward_e18);

      expect(await pion.totalSupply()).to.be.eq(0);
    });

    it("Should prevent from manipulating rewardAmount", async function() {
      const resp = await getDummySig(claimer1);
      const manipulatedReward = BigNumber.from(resp.result.total_reward_e18)
        .add(ONE).toString();
      await expect(
        rewardManager
          .connect(claimer1)
          .claimReward(manipulatedReward, resp.result.signature)
      ).to.be.revertedWith("Invalid signature.");
    });

  });

  
  describe("Withdraw", function () {
    it("Should allow to withdraw by owner", async function () {
      await pion.connect(deployer).mint(rewardManager.address, ONE.mul(100000));

      expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
        ONE.mul(100000)
      );

      expect(await pion.balanceOf(deployer.address)).to.be.equal(0);

      await expect(
        rewardManager
          .connect(deployer)
          .withdraw(pion.address, ONE.mul(10000), deployer.address)
      ).not.to.be.reverted;

      expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
        ONE.mul(100000 - 10000)
      );

      expect(await pion.balanceOf(deployer.address)).to.be.equal(
        ONE.mul(10000)
      );
    });

    it("Should not allow to withdraw by user", async function () {
      const revertMSG = "Ownable: caller is not the owner";

      await pion.connect(deployer).mint(rewardManager.address, ONE.mul(100000));

      expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
        ONE.mul(100000)
      );

      expect(await pion.balanceOf(deployer.address)).to.be.equal(0);

      await expect(
        rewardManager
          .connect(claimer1)
          .withdraw(pion.address, ONE.mul(10000), deployer.address)
      ).to.be.revertedWith(revertMSG);

      expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
        ONE.mul(100000)
      );

      expect(await pion.balanceOf(deployer.address)).to.be.equal(0);
    });
  });

  describe("Set signer", function () {
    it("Should allow the owner to set signer", async function () {
      await expect(
        rewardManager
          .connect(deployer)
          .setSigner(claimer1.address)
      ).not.to.be.reverted;

      expect((await rewardManager.functions.signer()).at(0)).to.be.equal(
        claimer1.address
      );
    });

    it("Should not allow the user to set signer", async function () {
      await expect(
        rewardManager
          .connect(claimer1)
          .setSigner(claimer1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect((await rewardManager.functions.signer()).at(0)).to.be.equal(
        rewardRole
      );
    });
  });
});
