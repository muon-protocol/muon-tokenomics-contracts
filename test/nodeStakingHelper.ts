import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, ContractReceipt, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { 
  MuonNodeManager, 
  MuonNodeStaking, 
  NodeStakingHelper,
  PIONtest,
  BondedPION,
  SchnorrSECP256K1VerifierV2,
} from "../typechain-types";

describe("NodeStakingHelper", function () {
  const ONE = ethers.utils.parseEther("1");

  let deployer: SignerWithAddress;
  let daoRole: SignerWithAddress;
  let rewardRole: SignerWithAddress;
  let node1: SignerWithAddress;
  let node2: SignerWithAddress;
  let node3: SignerWithAddress;
  let node4: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;
  let staker3: SignerWithAddress;
  let staker4: SignerWithAddress;
  let user: SignerWithAddress;
  let treasury: SignerWithAddress;

  let pion: PIONtest;
  let bondedPion: BondedPION;
  let nodeStaking: MuonNodeStaking;
  let nodeManager: MuonNodeManager;
  let nodeStakingHelper: NodeStakingHelper;
  let verifier: SchnorrSECP256K1VerifierV2;

  const thirtyDays = 2592000;
  const muonTokenMultiplier = ONE;

  const peerId1 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh1";
  const peerId2 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh2";
  const peerId3 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh3";
  const peerId4 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh4";

  const muonAppId =
    "1566432988060666016333351531685287278204879617528298155619493815104572633831";
  const muonPublicKey = {
    x: "0x708f698d97949cd4385f02b1cc5283d394e9a7da68e3b6d2871c830b0751a5bb",
    parity: 1,
  };

  const tier1 = 1;
  const tier2 = 2;

  const tier1MaxStake = ONE.mul(1000);
  const tier2MaxStake = ONE.mul(2500);

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
    [
      deployer,
      daoRole,
      rewardRole,
      node1,
      node2,
      node3,
      node4,
      staker1,
      staker2,
      staker3,
      staker4,
      user,
      treasury,
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
      0,
      0
    ]) as BondedPION;
    await bondedPion.deployed();

    const MuonNodeManager = await ethers.getContractFactory("MuonNodeManager");
    nodeManager = await upgrades.deployProxy(MuonNodeManager, [
      0, 0
    ]) as MuonNodeManager;
    await nodeManager.deployed();

    const SchnorrSECP256K1VerifierV2 = await ethers.getContractFactory("SchnorrSECP256K1VerifierV2");
    verifier = await SchnorrSECP256K1VerifierV2.connect(deployer).deploy();
    await verifier.deployed();

    const MuonNodeStaking = await ethers.getContractFactory("MuonNodeStaking");
    nodeStaking = await upgrades.deployProxy(MuonNodeStaking, [
      pion.address,
      nodeManager.address,
      muonAppId,
      muonPublicKey,
      bondedPion.address,
      0,
      0,
      0,
      0,
      0,
      0
    ]) as MuonNodeStaking;
    await nodeStaking.deployed();

    await nodeStaking
      .connect(deployer)
      .grantRole(await nodeStaking.DAO_ROLE(), daoRole.address);

    await nodeStaking
      .connect(deployer)
      .grantRole(await nodeStaking.REWARD_ROLE(), rewardRole.address);

    await nodeStaking
      .connect(daoRole)
      .updateStakingTokens(
        [pion.address],
        [muonTokenMultiplier]
      );

    await nodeStaking
      .connect(daoRole)
      .setVerifier(verifier.address);

    await bondedPion
      .connect(deployer)
      .grantRole(
        await bondedPion.TRANSFERABLE_ADDRESS_ROLE(),
        nodeStaking.address
      );

    await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier1, tier1MaxStake);
    await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier2, tier2MaxStake);

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.ADMIN_ROLE(), nodeStaking.address);

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.DAO_ROLE(), daoRole.address);

    await pion.connect(deployer).mint(rewardRole.address, ONE.mul(2000000));

    await mintBondedPion(ONE.mul(5000), staker1);
    await bondedPion.connect(staker1).approve(nodeStaking.address, 1);
    await nodeStaking.connect(staker1).addMuonNode(node1.address, peerId1, 1);

    await mintBondedPion(ONE.mul(6500), staker2);
    await bondedPion.connect(staker2).approve(nodeStaking.address, 2);
    await nodeStaking.connect(staker2).addMuonNode(node2.address, peerId2, 2);

    await mintBondedPion(ONE.mul(3000), staker3);
    await bondedPion.connect(staker3).approve(nodeStaking.address, 3);
    await nodeStaking.connect(staker3).addMuonNode(node3.address, peerId3, 3);

    await mintBondedPion(ONE.mul(700), staker4);
    await bondedPion.connect(staker4).approve(nodeStaking.address, 4);
    await nodeStaking.connect(staker4).addMuonNode(node4.address, peerId4, 4);

    await nodeStaking.connect(daoRole).setMuonNodeTier(staker1.address, tier1);
    await nodeStaking.connect(daoRole).setMuonNodeTier(staker2.address, tier2);
    await nodeStaking.connect(daoRole).setMuonNodeTier(staker3.address, tier2);
    await nodeStaking.connect(daoRole).setMuonNodeTier(staker4.address, tier1);

    const NodeStakingHelper = await ethers.getContractFactory("NodeStakingHelper");
    nodeStakingHelper = await NodeStakingHelper.connect(deployer).deploy(
      nodeStaking.address,
      nodeManager.address
    );
    await nodeStakingHelper.deployed();

    await nodeStaking.connect(deployer).grantRole(
      await nodeStaking.DAO_ROLE(), nodeStakingHelper.address
    );

  });

  describe("UpdateStakes", async function () {
    it("Should update nodes stakes", async function () {
      expect(
        (await nodeStaking.users(staker1.address)).balance
      ).to.equal(ONE.mul(1000));
      expect(
        (await nodeStaking.users(staker2.address)).balance
      ).to.equal(ONE.mul(2500));
      expect(
        (await nodeStaking.users(staker3.address)).balance
      ).to.equal(ONE.mul(2500));
      expect(
        (await nodeStaking.users(staker4.address)).balance
      ).to.equal(ONE.mul(700));

      await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier1, ONE.mul(3000));
      await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier2, ONE.mul(10000));

      await expect(
        nodeStakingHelper.connect(deployer).updateNodeStakes(
          [staker1.address, staker2.address, staker4.address]
        )
      ).not.to.be.reverted;

      expect(
        (await nodeStaking.users(staker1.address)).balance
      ).to.equal(ONE.mul(3000));
      expect(
        (await nodeStaking.users(staker2.address)).balance
      ).to.equal(ONE.mul(6500));
      expect(
        (await nodeStaking.users(staker3.address)).balance
      ).to.equal(ONE.mul(2500));
      expect(
        (await nodeStaking.users(staker4.address)).balance
      ).to.equal(ONE.mul(700));

      expect(
        (await nodeManager.nodes(1)).tier
      ).to.equal(tier1);
      expect(
        (await nodeManager.nodes(2)).tier
      ).to.equal(tier2);
      expect(
        (await nodeManager.nodes(3)).tier
      ).to.equal(tier2);
      expect(
        (await nodeManager.nodes(4)).tier
      ).to.equal(tier1);
    });

    it("Non-owner should not be able to update stakes", async function () {
      expect(
        (await nodeStaking.users(staker1.address)).balance
      ).to.equal(ONE.mul(1000));
      expect(
        (await nodeStaking.users(staker2.address)).balance
      ).to.equal(ONE.mul(2500));

      await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier1, ONE.mul(3000));
      await nodeStaking.connect(daoRole).setTierMaxStakeAmount(tier2, ONE.mul(10000));

      await expect(
        nodeStakingHelper.connect(user).updateNodeStakes(
          [staker1.address, staker2.address]
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(
        (await nodeStaking.users(staker1.address)).balance
      ).to.equal(ONE.mul(1000));
      expect(
        (await nodeStaking.users(staker2.address)).balance
      ).to.equal(ONE.mul(2500));
    });
  });
});
