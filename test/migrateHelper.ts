import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { MigrateHelper, PIONtest } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MigrateHelper", function () {
  const ONE = ethers.utils.parseEther("1");
  
  let deployer: SignerWithAddress;
  let claimer1: SignerWithAddress;
  let claimer2: SignerWithAddress;
  let signer: SignerWithAddress;

  let oldPion: PIONtest;
  let newPion: PIONtest;
  let migrateHelper: MigrateHelper;

  before(async () => {
    [
      deployer, 
      claimer1, 
      claimer2,
      signer
    ] = 
    await ethers.getSigners();
  });

  beforeEach(async function () {
    const oldPionFactory = await ethers.getContractFactory("PIONtest");
    oldPion = await upgrades.deployProxy(oldPionFactory, []) as PIONtest;
    await oldPion.deployed();

    oldPion.connect(deployer).mint(claimer1.address, ONE.mul(1000));

    const newPionFactory = await ethers.getContractFactory("PIONtest");
    newPion = await upgrades.deployProxy(newPionFactory, []) as PIONtest;
    await newPion.deployed();

    const migrateHelperFactory = await ethers.getContractFactory("MigrateHelper");
    migrateHelper = await migrateHelperFactory.connect(deployer).deploy(
      newPion.address, oldPion.address, signer.address
    );

    newPion.connect(deployer).mint(migrateHelper.address, ONE.mul(10000));
    oldPion.connect(claimer1).approve(migrateHelper.address, ONE.mul(1000));
  });

  const getDummySig = async (address: string, amount: BigNumber) => {
    const hash = ethers.utils.solidityKeccak256(
      ["address", "uint256"], 
      [address, amount.toString()]
    )

    let messageHash = ethers.utils.arrayify(hash);

    let sig = await signer.signMessage(messageHash)
    return sig
  };

  describe("Claim", function () {
    it("Should allow to claim new pions", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);

      const sig = await getDummySig(claimer1.address, ONE.mul(100));

      await migrateHelper.connect(claimer1).claim(ONE.mul(100), sig);

      expect(await newPion.balanceOf(claimer1.address)).to.eq(ONE.mul(100));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000 - 100));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000 - 100));
      expect(await oldPion.totalSupply()).to.eq(ONE.mul(1000 - 100));
      expect(await newPion.totalSupply()).to.eq(ONE.mul(10000));
    });

    it("Should prevent using others' signature", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);
      expect(await newPion.balanceOf(claimer2.address)).to.eq(0);

      const sig = await getDummySig(claimer1.address, ONE.mul(100));

      await expect(migrateHelper.connect(claimer2).claim(ONE.mul(100), sig))
        .to.be.revertedWith("Invalid signature");

      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);
      expect(await newPion.balanceOf(claimer2.address)).to.eq(0);
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000));
    });

    it("Should prevent manipulating amount", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);

      const sig = await getDummySig(claimer1.address, ONE.mul(100));

      await expect(migrateHelper.connect(claimer1).claim(ONE.mul(101), sig))
        .to.be.revertedWith("Invalid signature");

      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000));
    });

    it("Should prevent reusing the signature", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);

      const sig = await getDummySig(claimer1.address, ONE.mul(100));

      await migrateHelper.connect(claimer1).claim(ONE.mul(100), sig);

      await expect(migrateHelper.connect(claimer1).claim(ONE.mul(100), sig))
        .to.be.revertedWith("Invalid amount");

      expect(await newPion.balanceOf(claimer1.address)).to.eq(ONE.mul(100));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000 - 100));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000 - 100));
    });

    it("Should allow to claim additional pions", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);

      let sig = await getDummySig(claimer1.address, ONE.mul(100));

      await migrateHelper.connect(claimer1).claim(ONE.mul(100), sig);

      expect(await newPion.balanceOf(claimer1.address)).to.eq(ONE.mul(100));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000 - 100));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000 - 100));

      sig = await getDummySig(claimer1.address, ONE.mul(250));

      await migrateHelper.connect(claimer1).claim(ONE.mul(250), sig);

      expect(await newPion.balanceOf(claimer1.address)).to.eq(ONE.mul(250));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000 - 250));
      expect(await oldPion.balanceOf(claimer1.address)).to.eq(ONE.mul(1000 - 250));
      expect(await oldPion.totalSupply()).to.eq(ONE.mul(1000 - 250));
    });
  });

  describe("Set signer", async function () {
    it("Should allow the owner to set the signer", async function () {
      const [newSigner] = await ethers.getSigners()
      await expect(migrateHelper.connect(deployer).setSigner(newSigner.address))
        .not.to.be.reverted;
    });

    it("Should not allow the non-owner to set the signer", async function () {
      const [newSigner] = await ethers.getSigners()
      await expect(migrateHelper.connect(claimer1).setSigner(newSigner.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Set muon token", async function () {
    it("Should allow the owner to set the muon token", async function () {
      const newTokenFactory = await ethers.getContractFactory("PIONtest");
      const newToken = await upgrades.deployProxy(newTokenFactory, []) as PIONtest;
      await newToken.deployed();

      expect(await migrateHelper.muonToken()).to.eq(newPion.address);
      await expect(migrateHelper.connect(deployer).setMuonToken(newToken.address))
        .not.be.reverted;
      expect(await migrateHelper.muonToken()).to.eq(newToken.address);
    });

    it("Should not allow the non-owner to set the muon token", async function () {
      const newTokenFactory = await ethers.getContractFactory("PIONtest");
      const newToken = await upgrades.deployProxy(newTokenFactory, []) as PIONtest;
      await newToken.deployed();

      expect(await migrateHelper.muonToken()).to.eq(newPion.address);
      await expect(migrateHelper.connect(claimer1).setMuonToken(newToken.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
      expect(await migrateHelper.muonToken()).to.eq(newPion.address);
    });
  });

  describe("Withdraw", async function () {
    it("Should allow the owner to withdraw pions", async function () {
      expect(await newPion.balanceOf(deployer.address)).to.eq(0);
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
      await expect(migrateHelper.connect(deployer).ownerWithdraw(
        newPion.address, ONE.mul(100), deployer.address
      )).not.be.reverted;
      expect(await newPion.balanceOf(deployer.address)).to.eq(ONE.mul(100));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000 - 100));
    });

    it("Should not allow the non-owner to withdraw pions", async function () {
      expect(await newPion.balanceOf(claimer1.address)).to.eq(0);
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
      await expect(migrateHelper.connect(claimer1).ownerWithdraw(
        newPion.address, ONE.mul(100), claimer1.address
      )).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await newPion.balanceOf(claimer1.address)).to.eq(ONE.mul(0));
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
    });

    it("Should not allow to withdraw pions to zero address", async function () {
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
      await expect(migrateHelper.connect(deployer).ownerWithdraw(
        newPion.address, ONE.mul(100), ethers.constants.AddressZero
      )).to.be.reverted;
      expect(await newPion.balanceOf(migrateHelper.address)).to.eq(ONE.mul(10000));
    });
  });
});
