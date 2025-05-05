import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MuonVestingManager,
  MUON,
  BondedMUON,
  MuonNodeManager,
  MuonNodeStaking
} from "../typechain-types";
import { describe, it, beforeEach } from "mocha";
import { BigNumber } from "ethers";

describe("MuonVestingManager", function () {
  const ONE = ethers.utils.parseEther("1");

  let muonVesting: MuonVestingManager;
  let muon: MUON;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;

  const user1Balance = ONE.mul(500);
  const user2Balance = ONE.mul(500);
  const user3Balance = ONE.mul(1000);
  const user4Balance = ONE.mul(700);
  const userAddresses: any[] = [];
  const userBalances = [user1Balance, user2Balance, user3Balance, user4Balance];

  const evmIncreaseTime = async (amount: number) => {
    await ethers.provider.send("evm_increaseTime", [amount]);
    await ethers.provider.send("evm_mine", []);
  };

  before(async function () {
    [admin, user, user1, user2, user3, user4] =
      await ethers.getSigners();
      userAddresses.push(
        user1.address,
        user2.address,
        user3.address,
        user4.address
      );
  });

  beforeEach(async () => {
    const [Muon] = await Promise.all([
      ethers.getContractFactory("MUON")
    ]);
  
    muon = (await upgrades.deployProxy(Muon, [])) as MUON;
    await muon.deployed();

    const MuonVestingFactory = await ethers.getContractFactory(
      "MuonVestingManager"
    );

    const START_TIME = await time.latest() + (24 * 60 * 60); // tomorrow
    const DURATION = 28512000; // 11 months

    muonVesting = await MuonVestingFactory.connect(admin).deploy(
      muon.address,
      START_TIME,
      DURATION
    );

    await muonVesting.deployed();

    await muon.connect(admin).grantRole(
      await muon.MINTER_ROLE(),
      admin.address
    );

    await muon.connect(admin).mint(
      muonVesting.address,
      ONE.mul(3000)
    );
    
    await muonVesting.connect(admin).bulkImport(userAddresses, userBalances);

  });

  describe("Import users", async () => {
    it("should import users successfully", async () => {
      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user2.address)).vestedAmount).to.be.equal(user2Balance);
      expect((await muonVesting.users(user3.address)).vestedAmount).to.be.equal(user3Balance);
      expect((await muonVesting.users(user4.address)).vestedAmount).to.be.equal(user4Balance);

      expect((await muonVesting.users(user.address)).released).to.be.equal(0);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect((await muonVesting.users(user3.address)).released).to.be.equal(0);
      expect((await muonVesting.users(user4.address)).released).to.be.equal(0);

      expect(await muonVesting.releasable(user.address)).to.be.equal(0);
      expect(await muonVesting.releasable(user1.address)).to.be.equal(0);
      expect(await muonVesting.releasable(user2.address)).to.be.equal(0);
      expect(await muonVesting.releasable(user3.address)).to.be.equal(0);
      expect(await muonVesting.releasable(user4.address)).to.be.equal(0);

      expect(await muonVesting.releaseForApproved(user.address)).to.be.equal(false);
      expect(await muonVesting.releaseForApproved(user1.address)).to.be.equal(false);
      expect(await muonVesting.releaseForApproved(user2.address)).to.be.equal(false);
      expect(await muonVesting.releaseForApproved(user3.address)).to.be.equal(false);
      expect(await muonVesting.releaseForApproved(user4.address)).to.be.equal(false);
    });

    it("should let admin to change users info", async () => {
      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      expect((await muonVesting.users(user2.address)).vestedAmount).to.be.equal(user2Balance);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);

      await muonVesting.connect(admin).bulkImport([user1.address], [0]);

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      expect((await muonVesting.users(user2.address)).vestedAmount).to.be.equal(user2Balance);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user.address)).released).to.be.equal(0);

      await muonVesting.connect(admin).bulkImport([user.address], [user1Balance]);

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user.address)).released).to.be.equal(0);
    });

    it("should not let non-admin to change users info", async () => {
      const ADMIN_ROLE = await muonVesting.ADMIN_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${ADMIN_ROLE}`;
      await expect(
        muonVesting.connect(user).bulkImport([user.address], [user1Balance])
      ).to.be.revertedWith(revertMSG);
    });
  });

  describe("Release tokens", async () => {
    it("should not release tokens before start time", async () => {
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
      expect(await muonVesting.releasable(user1.address)).to.be.equal(0);

      await expect(muonVesting
        .connect(user1)
        .release(ONE.mul(10))).to.be.revertedWith("amount exceeds releasable amount!");

      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });

    it("should release tokens successfully", async () => {
      const startTime = Number(await muonVesting.start());
      await evmIncreaseTime(startTime - await time.latest());

      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
      expect(await muonVesting.releasable(user1.address)).to.be.equal(0);

      await evmIncreaseTime(10);

      const releasableAmount = user1Balance.mul(10).div(
        28512000
      );

      expect(await muonVesting.releasable(user1.address)).to.be.equal(
        releasableAmount  
      );

      await muonVesting.connect(user1).release(releasableAmount);

      expect((await muonVesting.users(user1.address)).released).to.be.equal(releasableAmount);
      expect(await muon.balanceOf(user1.address)).to.be.equal(releasableAmount);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000).sub(releasableAmount)
      );
      
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muonVesting.releasable(user2.address)).to.be.equal(
        user2Balance.mul(await time.latest() - startTime).div(
          28512000
        )
      );

      const newReleasableAmount = user1Balance.mul(await time.latest() - startTime).div(
        28512000
      );

      expect(await muonVesting.releasable(user1.address)).to.be.equal(
        newReleasableAmount.sub(releasableAmount)
      );

    });

    it("should not release tokens more than releasable amount", async () => {
      const startTime = Number(await muonVesting.start());
      await evmIncreaseTime(startTime - await time.latest());

      await evmIncreaseTime(24 * 60 * 60);

      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      const releasableAmount = user1Balance.mul(24 * 60 * 60).div(
        28512000
      );

      expect(await muonVesting.releasable(user1.address)).to.be.equal(
        releasableAmount  
      );

      await expect(muonVesting
        .connect(user1)
        .release(releasableAmount.add(ONE.mul(1)))).to.be.revertedWith("amount exceeds releasable amount!");

      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });

    it("should not release more than vested amount", async () => {
      const endTime = Number(await muonVesting.end());
      await evmIncreaseTime(endTime - (await time.latest()));

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      expect(await muonVesting.releasable(user2.address)).to.be.equal(
        user2Balance
      );

      await expect(muonVesting
        .connect(user2)
        .release(user2Balance.add(1))).to.be.revertedWith("amount exceeds releasable amount!");

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      await evmIncreaseTime(24 * 60 * 60);

      expect(await muonVesting.releasable(user2.address)).to.be.equal(
        user2Balance
      );

      await expect(muonVesting
        .connect(user2)
        .release(user2Balance.add(1))).to.be.revertedWith("amount exceeds releasable amount!");

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });

    it("should be able to release all vested amount at the end", async () => {
      const endTime = Number(await muonVesting.end());
      await evmIncreaseTime(endTime - (await time.latest()));

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      expect(await muonVesting.releasable(user2.address)).to.be.equal(
        user2Balance
      );

      await muonVesting.connect(user2).release(user2Balance);

      expect(await muon.balanceOf(user2.address)).to.be.equal(user2Balance);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(user2Balance);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000).sub(user2Balance)
      );
      expect(await muonVesting.releasable(user2.address)).to.be.equal(0);
    });

    it("should be able to release on behalf of a user if it's approved", async () => {
      const startTime = Number(await muonVesting.start());
      await evmIncreaseTime(startTime - (await time.latest()));

      await evmIncreaseTime(24 * 60 * 60);

      await muonVesting.connect(admin).grantRole(
        await muonVesting.RELEASE_FOR_ROLE(),
        user.address
      );

      await muonVesting.connect(user2).setApproveReleaseFor(true);

      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      const releasableAmount = await muonVesting.releasable(user2.address);

      await muonVesting.connect(user).releaseFor(user2.address, releasableAmount);

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(releasableAmount);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(releasableAmount);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000).sub(releasableAmount)
      );
    });

    it("should be able to release on behalf of a user if it's not approved", async () => {
      const startTime = Number(await muonVesting.start());
      await evmIncreaseTime(startTime - (await time.latest()));

      await evmIncreaseTime(24 * 60 * 60);

      await muonVesting.connect(admin).grantRole(
        await muonVesting.RELEASE_FOR_ROLE(),
        user.address
      );

      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      const releasableAmount = await muonVesting.releasable(user2.address);

      await expect(
        muonVesting.connect(user).releaseFor(user2.address, releasableAmount)
      ).to.be.revertedWith("Not approved");

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });

    it("should be able to revoke releaseFor", async () => {
      const startTime = Number(await muonVesting.start());
      await evmIncreaseTime(startTime - (await time.latest()));

      await evmIncreaseTime(24 * 60 * 60);

      await muonVesting.connect(admin).grantRole(
        await muonVesting.RELEASE_FOR_ROLE(),
        user.address
      );

      await muonVesting.connect(user2).setApproveReleaseFor(true);

      expect((await muonVesting.users(user2.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      const releasableAmount = await muonVesting.releasable(user2.address);

      await muonVesting.connect(user).releaseFor(user2.address, releasableAmount);

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(releasableAmount);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(releasableAmount);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000).sub(releasableAmount)
      );

      await muonVesting.connect(user2).setApproveReleaseFor(false);

      await evmIncreaseTime(24 * 60 * 60);

      const newReleasableAmount = await muonVesting.releasable(user2.address);

      await expect(
        muonVesting.connect(user).releaseFor(user2.address, newReleasableAmount)
      ).to.be.revertedWith("Not approved");

      expect(await muon.balanceOf(user2.address)).to.be.equal(0);
      expect(await muon.balanceOf(user.address)).to.be.equal(releasableAmount);
      expect((await muonVesting.users(user2.address)).released).to.be.equal(releasableAmount);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000).sub(releasableAmount)
      );
    });
  });

  describe("Pause functions", async () => {
    it("should not release tokens if it's paused", async () => {
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      await muonVesting.connect(admin).pause();

      await expect(muonVesting
        .connect(user1)
        .release(ONE)).to.be.revertedWith("Pausable: paused");

      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });

    it("should not releaseFor tokens if it's paused", async () => {
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );

      await muonVesting.connect(admin).pause();

      await muonVesting.connect(admin).grantRole(
        await muonVesting.RELEASE_FOR_ROLE(),
        user.address
      );

      await muonVesting.connect(user1).setApproveReleaseFor(true);

      await expect(muonVesting
        .connect(user)
        .releaseFor(user1.address, ONE)).to.be.revertedWith("Pausable: paused");

      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);
      expect(await muon.balanceOf(user1.address)).to.be.equal(0);
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
    });
  });

  describe("Admin operations", async () => {
    it("should allow admin to pause contract", async () => {
      expect(await muonVesting.paused()).to.be.eq(false);
      await muonVesting.connect(admin).pause();
      expect(await muonVesting.paused()).to.be.eq(true);
    });
    it("should not allow non-admin to pause contract", async () => {
      expect(await muonVesting.paused()).to.be.eq(false);
      const ADMIN_ROLE = await muonVesting.ADMIN_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${ADMIN_ROLE}`;
      await expect(muonVesting.connect(user).pause()).to.be.revertedWith(revertMSG);
      expect(await muonVesting.paused()).to.be.eq(false);
    });
    it("should allow admin to withdraw tokens", async () => {
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      
      await muonVesting.connect(admin).adminWithdraw(ONE.mul(100), user.address, muon.address);

      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000 - 100)
      );
      expect(await muon.balanceOf(user.address)).to.be.equal(ONE.mul(100));
    });
    it("should not allow non-admin to withdraw tokens", async () => {
      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect(await muon.balanceOf(admin.address)).to.be.equal(0);
      
      const ADMIN_ROLE = await muonVesting.ADMIN_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${ADMIN_ROLE}`;
      await expect(
        muonVesting.connect(user).adminWithdraw(ONE.mul(100), user.address, muon.address)
      ).to.be.revertedWith(revertMSG);
      await expect(
        muonVesting.connect(user).adminWithdraw(ONE.mul(100), admin.address, muon.address)
      ).to.be.revertedWith(revertMSG);

      expect(await muon.balanceOf(muonVesting.address)).to.be.equal(
        ONE.mul(3000)
      );
      expect(await muon.balanceOf(user.address)).to.be.equal(0);
      expect(await muon.balanceOf(admin.address)).to.be.equal(0);
    });
    it("should allow admin to edit users", async () => {
      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      await muonVesting.connect(admin).editUser(user1.address, user1Balance, ONE.mul(10));

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(ONE.mul(10));

      await muonVesting.connect(admin).editUser(user1.address, 0, 0);

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      await muonVesting.connect(admin).editUser(user1.address, ONE.mul(30), ONE.mul(10));

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(ONE.mul(30));
      expect((await muonVesting.users(user1.address)).released).to.be.equal(ONE.mul(10));

      await expect(
        muonVesting.connect(admin).editUser(user1.address, ONE.mul(30), ONE.mul(40))
      ).to.be.revertedWith("Invalid released amount");

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(ONE.mul(30));
      expect((await muonVesting.users(user1.address)).released).to.be.equal(ONE.mul(10));

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user.address)).released).to.be.equal(0);

      await muonVesting.connect(admin).editUser(user.address, ONE.mul(3000), ONE.mul(10));

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(ONE.mul(3000));
      expect((await muonVesting.users(user.address)).released).to.be.equal(ONE.mul(10));
    });
    it("should not allow non-admin to edit users", async () => {
      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      const ADMIN_ROLE = await muonVesting.ADMIN_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${ADMIN_ROLE}`;

      await expect(
        muonVesting.connect(user).editUser(user1.address, user1Balance, ONE.mul(10))
      ).to.be.revertedWith(revertMSG);

      expect((await muonVesting.users(user1.address)).vestedAmount).to.be.equal(user1Balance);
      expect((await muonVesting.users(user1.address)).released).to.be.equal(0);

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user.address)).released).to.be.equal(0);

      await expect(
        muonVesting.connect(user).editUser(user.address, ONE.mul(10), 0)
      ).to.be.revertedWith(revertMSG);

      expect((await muonVesting.users(user.address)).vestedAmount).to.be.equal(0);
      expect((await muonVesting.users(user.address)).released).to.be.equal(0);
    });
  });
});
