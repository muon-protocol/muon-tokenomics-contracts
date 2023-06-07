import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PION } from "../typechain-types";
import { deployPION } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("PION", function () {
  let pion: PION;
  let admin: SignerWithAddress, user: SignerWithAddress, staking: SignerWithAddress;

  before(async () => {
    [admin, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const contracts = await loadFixture(deployPION);
    pion = contracts.pion.connect(user);
  });

  describe("Mint", async function () {
    it("Should not mint PION by user", async function () {
      const pionAmount = ethers.utils.parseEther("100");
      const minterRole = await pion.MINTER_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${minterRole}`;
      await expect(
        pion.connect(user).mint(user.address, pionAmount)
      ).to.be.revertedWith(revertMSG);
    });

    it("Should mint PION by admin", async function () {
        const pionAmount = ethers.utils.parseEther("100");
        await pion.connect(admin).mint(user.address, pionAmount);

        expect(await pion.balanceOf(user.address)).eq(pionAmount)
      });
  });

  describe("Pause and Unpaused", async function () {
    it("Should not pause and unpause PION by user", async function () {
      const pionAmount = ethers.utils.parseEther("100");

      await pion.connect(admin).mint(user.address, pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);

      const pauserRole = await pion.PAUSER_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${pauserRole}`;
      await expect(pion.connect(user).pause()).to.be.revertedWith(revertMSG);

      await pion.connect(admin).pause();

      await expect(pion.connect(user).unpause()).to.be.revertedWith(revertMSG);
    });

    it("Should pause and unpause PION", async function () {
        const pionAmount = ethers.utils.parseEther("100");
  
        await pion.connect(admin).mint(user.address, pionAmount);
        expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);
        await pion.connect(admin).pause();
  
        await expect(
          pion.connect(admin).mint(user.address, pionAmount)
        ).to.be.revertedWith("Pausable: paused");
        await expect(
          pion.connect(user).transfer(admin.address, pionAmount)
        ).to.be.revertedWith("Pausable: paused");
        await expect(pion.connect(user).burn(pionAmount)).to.be.revertedWith(
          "Pausable: paused"
        );
  
        await pion.connect(admin).unpause();
  
        await pion.connect(admin).mint(user.address, pionAmount);
        expect(await pion.connect(user).balanceOf(user.address)).eq(
          pionAmount.mul(2)
        );
  
        await pion.connect(user).transfer(admin.address, pionAmount);
        expect(await pion.connect(admin).balanceOf(admin.address)).eq(pionAmount);
        expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);
  
        await pion.connect(user).burn(pionAmount);
        expect(await pion.connect(user).balanceOf(user.address)).eq(0);
      });
  });
});
