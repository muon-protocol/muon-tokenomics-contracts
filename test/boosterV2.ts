import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, ContractReceipt, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PIONtest, BondedPION, BoosterV2} from "../typechain-types";

describe("Booster", function () {
  const ONE = ethers.utils.parseEther("1");

  let deployer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;
  let user: SignerWithAddress;
  let nftId1: number;

  let pion: PIONtest;
  let bondedPion: BondedPION;
  let booster: BoosterV2;
  let boostValue: BigNumber;

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

    pion.mint(staker1.address, ONE.mul(300));
    pion.mint(staker2.address, ONE.mul(500));

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = (await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
      0,
      0
    ])) as BondedPION;
    await bondedPion.deployed();

    nftId1 = await mintBondedPion(ONE.mul(100), staker1);

    const Booster = await ethers.getContractFactory("BoosterV2");
    booster = await Booster.connect(deployer).deploy(
      pion.address,
      bondedPion.address,
      ONE.mul(2)
    );
    await booster.deployed();
    boostValue = await booster.boostValue();

    await pion.connect(staker1).approve(booster.address, ONE.mul(300));
    await pion.connect(staker2).approve(booster.address, ONE.mul(500));

    await pion
      .connect(deployer)
      .grantRole(await pion.MINTER_ROLE(), booster.address);
    await bondedPion
      .connect(deployer)
      .grantRole(await bondedPion.BOOSTER_ROLE(), booster.address);
  });

  describe("Boost", async function () {
    it("Should boost the staker bondedPion", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);
      expect(await pion.balanceOf(booster.address)).eq(0);
      expect(await pion.balanceOf(staker1.address)).eq(ONE.mul(300));
      
      const pionSupplyBeforeBoost = await pion.totalSupply();

      await expect(
        booster.connect(staker1).boost(nftId1, ONE.mul(150))
      ).not.to.be.reverted;

      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(400)]);
    
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(0));
      expect(await pion.balanceOf(staker1.address)).eq(ONE.mul(150));
      expect(await pion.totalSupply()).eq(pionSupplyBeforeBoost.sub(ONE.mul(150)));
    });

    it("Should not boost with amount 0", async function () {
      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);
      expect(await pion.balanceOf(booster.address)).eq(0);
      expect(await pion.balanceOf(staker1.address)).eq(ONE.mul(300));

      const pionSupplyBeforeBoost = await pion.totalSupply();

      await expect(
        booster.connect(staker1).boost(nftId1, ONE.mul(0))
      ).to.be.revertedWith("0 amount");

      expect(
        await bondedPion.getLockedOf(nftId1, [pion.address])
      ).to.deep.equal([ONE.mul(100)]);

      expect(await pion.balanceOf(booster.address)).eq(0);
      expect(await pion.balanceOf(staker1.address)).eq(ONE.mul(300));
      expect(await pion.totalSupply()).eq(pionSupplyBeforeBoost);
    });
  });

  describe("Create and Boost", async function () {
    it("Should create and boost", async function () {
      expect(await pion.balanceOf(staker1.address)).eq(ONE.mul(300));
      const pionTotalSupply = await pion.totalSupply();

      const nftId = await booster.connect(staker2).callStatic.createAndBoost(ONE.mul(200));
      await expect(
        booster
          .connect(staker2)
          .createAndBoost(ONE.mul(200))
      ).not.to.be.reverted;

      expect(nftId).eq(2);
      expect(await bondedPion.ownerOf(nftId)).eq(staker2.address);
      expect(await bondedPion.getLockedOf(nftId, [pion.address])).to.deep.equal(
        [ONE.mul(400)]
      );
      expect(await pion.balanceOf(staker2.address)).eq(ONE.mul(300));
      expect(await pion.totalSupply()).eq(pionTotalSupply.sub(ONE.mul(200)));
    });

    it("Should not create and boost with muonAmount 0", async function () {
      expect(await pion.balanceOf(staker2.address)).eq(ONE.mul(500));
      const pionTotalSupply = await pion.totalSupply();
      await expect(
        booster
          .connect(staker2)
          .createAndBoost(0)
      ).to.be.rejectedWith("0 amount");
      expect(await pion.balanceOf(staker2.address)).eq(ONE.mul(500));
      expect(await pion.totalSupply()).eq(pionTotalSupply);
    });
  });

  describe("Owner operations", async function () {
    it("Should allow the owner to withdraw the PION tokens", async function () {
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

    it("Should not allow the owner to withdraw and send to address 0", async function () {
      const zeroAddress = ethers.constants.AddressZero;
      await pion.connect(deployer).mint(booster.address, ONE.mul(100000));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(deployer.address)).eq(0);

      await expect(
        booster
          .connect(deployer)
          .adminWithdraw(ONE.mul(70), zeroAddress, pion.address)
      ).to.be.reverted;
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
    });

    it("Should not allow NON-OWNER to withdraw the PION tokens", async function () {
      await pion.connect(deployer).mint(booster.address, ONE.mul(100000));
      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(user.address)).eq(0);

      const revertMSG = "Ownable: caller is not the owner";

      await expect(
        booster
          .connect(user)
          .adminWithdraw(ONE.mul(100), user.address, pion.address)
      ).to.be.revertedWith(revertMSG);

      expect(await pion.balanceOf(booster.address)).eq(ONE.mul(100000));
      expect(await pion.balanceOf(user.address)).eq(0);
    });

    it("Should allow the owner to set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await booster.connect(deployer).setBoostValue(ONE.mul(3));

      expect(await booster.boostValue()).eq(ONE.mul(3));
    });

    it("Should not allow NON-OWNER to set boostValue", async function () {
      expect(await booster.boostValue()).eq(ONE.mul(2));

      await expect(booster.connect(user).setBoostValue(ONE.mul(3))).to.be
        .reverted;

      expect(await booster.boostValue()).eq(ONE.mul(2));
    });
  });
});
