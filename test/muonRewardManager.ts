import { ethers, upgrades } from "hardhat";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import axios from "axios";

import { MuonRewardManager, PIONtest, BondedPION } from "../typechain-types";

describe("MuonRewardManager", function () {
  const ONE = ethers.utils.parseEther("1");

  const rewardRole = "0x3E15aEAE0414B0400f29B41fc9e12e2CBa08e8d5";
  const dummyServer = "https://alice-test.muon.net/reward-server/rewardsTest";

  let deployer: Signer;
  let claimer1: Signer;
  let claimer2: Signer;
  let treasury: Signer;

  let rewardManager: MuonRewardManager;
  let pion: PIONtest;
  let bondedPion: BondedPION;

  before(async () => {
    [deployer, claimer1, claimer2, treasury] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
    const PIONtest = await ethers.getContractFactory("PIONtest");
    pion = await upgrades.deployProxy(PIONtest, []);
    await pion.deployed();

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
    ]);
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

  const getDummySig = async (claimer) => {
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
      const tokenId =
        receipt.events[receipt.events.length - 1].args.tokenId.toNumber();
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
      const resp = await getDummySig(claimer1, [claimer1]);
      await expect(
        rewardManager
          .connect(claimer2)
          .claimReward(resp.result.total_reward_e18, resp.result.signature)
      ).to.be.revertedWith("Invalid signature.");
    });
  });

  
  // describe("Withdraw", function () {
  //   it("Should allow to withdraw by admin", async function () {
  //     expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
  //       ONE.mul(100000)
  //     );

  //     expect(await pion.balanceOf(deployer.address)).to.be.equal(0);

  //     await expect(
  //       rewardManager
  //         .connect(deployer)
  //         .withdraw(pion.address, ONE.mul(10000), deployer.address)
  //     ).not.to.be.reverted;

  //     expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
  //       ONE.mul(100000 - 10000)
  //     );

  //     expect(await pion.balanceOf(deployer.address)).to.be.equal(
  //       ONE.mul(10000)
  //     );
  //   });

  //   it("Should not allow to withdraw by user", async function () {
  //     const revertMSG = `AccessControl: account ${claimer1.address.toLowerCase()} is missing role`;
  //     expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
  //       ONE.mul(100000)
  //     );

  //     expect(await pion.balanceOf(deployer.address)).to.be.equal(0);

  //     await expect(
  //       rewardManager
  //         .connect(claimer1)
  //         .withdraw(pion.address, ONE.mul(10000), deployer.address)
  //     ).to.be.revertedWith(revertMSG);

  //     expect(await pion.balanceOf(rewardManager.address)).to.be.equal(
  //       ONE.mul(100000)
  //     );

  //     expect(await pion.balanceOf(deployer.address)).to.be.equal(0);
  //   });
  // });
});
