import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PION, Minter } from "../typechain-types";
import { deployMinter } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Minter", function () {
  let pion: PION, minter: Minter;
  let admin: SignerWithAddress,
    user: SignerWithAddress,
    staking: SignerWithAddress;
  let MINTER_ROLE: string, PAUSER_ROLE: string;
  let mintAmount: ethers.BigNumber, mintPeriod: ethers.BigNumber;

  const evmIncreaseTime = async (amount: ethers.BigNumber) => {
    await ethers.provider.send("evm_increaseTime", [amount.toNumber()]);
    await ethers.provider.send("evm_mine", []);
  };

  before(async () => {
    [admin, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const contracts = await loadFixture(deployMinter);
    pion = contracts.pion.connect(user);
    minter = contracts.minter.connect(user);
    staking = contracts.staking;

    MINTER_ROLE = await pion.MINTER_ROLE();
    PAUSER_ROLE = await pion.PAUSER_ROLE();
    mintAmount = await minter.mintAmount();
    mintPeriod = await minter.mintPeriod();
  });

  describe("Mint", async function () {
    it("Should mint for staking PION by user", async function () {
      const revertMSG = `AccessControl: account ${minter.address.toLowerCase()} is missing role ${MINTER_ROLE}`;
      await expect(minter.connect(user).mint()).to.be.revertedWith(revertMSG);
    });

    it("Should mint for staking PION by user", async function () {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);
      await minter.connect(admin).mint();

      expect(await pion.balanceOf(staking.address)).eq(mintAmount);
    });

    it("Should not mint twice in one mint period", async function () {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);

      await evmIncreaseTime(mintPeriod.div(2)); // 1/2 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);
    });

    it("Should mint again after mint period", async function () {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);

      await evmIncreaseTime(mintPeriod); // 1 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount.mul(2));

      await evmIncreaseTime(mintPeriod.div(2)); // 1/2 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount.mul(2));

      await evmIncreaseTime(mintPeriod.div(2)); // 1/2 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount.mul(3));
    });
  });

  describe("Pause and Unpaused", async function () {
    beforeEach(async () => {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);
    });

    it("Should not mint when paused", async function () {
      await minter.connect(admin).pause();
      await expect(minter.connect(admin).mint()).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("Should pause by user", async function () {
      await expect(minter.connect(user).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await minter.connect(user).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);
    });

    it("Should not mint when PION paused", async function () {
      await pion.connect(admin).pause();
      await expect(minter.connect(admin).mint()).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("Should unpause", async function () {
      await minter.connect(admin).pause();
      await expect(minter.connect(admin).mint()).to.be.revertedWith(
        "Pausable: paused"
      );

      await minter.connect(admin).unpause();
      await minter.connect(user).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);
    });

    it("Should not unpause by user", async function () {
      await minter.connect(admin).pause();
      await expect(minter.connect(admin).mint()).to.be.revertedWith(
        "Pausable: paused"
      );

      await expect(minter.connect(user).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(minter.connect(admin).mint()).to.be.revertedWith(
        "Pausable: paused"
      );
    });
  });

  describe("Set mint amount", async function () {
    beforeEach(async () => {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);
    });

    it("Should not set mint amount by user", async function () {
      await expect(
        minter.connect(user).setMintAmount(mintAmount.mul(2))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should set mint amount by admin", async function () {
      await minter.connect(admin).setMintAmount(mintAmount.mul(2));

      await minter.connect(user).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount.mul(2));
    });
  });

  describe("Set mint period", async function () {
    beforeEach(async () => {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);
    });

    it("Should not set mint period by user", async function () {
      await expect(
        minter.connect(user).setMintPeriod(mintPeriod.mul(2))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should set mint period by admin", async function () {
      await minter.connect(admin).setMintPeriod(mintPeriod.mul(2));

      await minter.connect(user).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);

      await evmIncreaseTime(mintPeriod); // 1 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount);

      await evmIncreaseTime(mintPeriod); // 1 mint period

      await minter.connect(admin).mint();
      expect(await pion.balanceOf(staking.address)).eq(mintAmount.mul(2));
    });
  });

  describe("Set staking", async function () {
    beforeEach(async () => {
      await pion.connect(admin).grantRole(MINTER_ROLE, minter.address);
    });

    it("Should not set staking address by user", async function () {
      await expect(
        minter.connect(user).setStaking(user.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should set staking address by admin", async function () {
      await minter.connect(admin).setStaking(user.address);

      await minter.connect(user).mint();
      expect(await pion.balanceOf(user.address)).eq(mintAmount);
    });

    it("Should not set address(0) as staking address", async function () {
      const zeroAddress = ethers.constants.AddressZero;
      await expect(
        minter.connect(admin).setStaking(zeroAddress)
      ).to.be.revertedWith("Zero Address");
    });
  });
});
