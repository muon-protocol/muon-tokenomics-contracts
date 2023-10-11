import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import axios from "axios";

import {
  MuonNodeManager,
  MuonNodeStaking,
  PIONtest,
  PIONlpTest,
  BondedPION,
  SchnorrSECP256K1VerifierV2,
  TierSetter
} from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("TierSetter", function () {
  const ONE = ethers.utils.parseEther("1");

  let deployer: Signer;
  let daoRole: Signer;
  let rewardRole: Signer;
  let signer: SignerWithAddress;
  let node1: Signer;
  let node2: Signer;
  let node3: Signer;
  let staker1: Signer;
  let staker2: Signer;
  let staker3: Signer;
  let user1: Signer;
  let treasury: Signer;

  const peerId1 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh1";
  const peerId2 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh2";
  const peerId3 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh3";

  let nodeManager: MuonNodeManager;
  let pion: PIONtest;
  let pionLp: PIONlpTest;
  let nodeStaking: MuonNodeStaking;
  let tierSetter: TierSetter;
  let bondedPion: BondedPION;
  let verifier: SchnorrSECP256K1VerifierV2;
  const thirtyDays = 2592000;
  const muonTokenMultiplier = ONE;
  const muonLpTokenMultiplier = ONE.mul(2);

  const muonAppId =
    "1566432988060666016333351531685287278204879617528298155619493815104572633831";
  const muonPublicKey = {
    x: "0x708f698d97949cd4385f02b1cc5283d394e9a7da68e3b6d2871c830b0751a5bb",
    parity: 1,
  };
  
  const tier1 = 1;
  const tier2 = 2;
  const tier3 = 3;

  const tier1MaxStake = ONE.mul(1000);
  const tier2MaxStake = ONE.mul(4000);
  const tier3MaxStake = ONE.mul(10000);

  before(async () => {
    [
      deployer,
      daoRole,
      rewardRole,
      signer,
      node1,
      node2,
      node3,
      staker1,
      staker2,
      staker3,
      user1,
      treasury,
    ] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const PIONtest = await ethers.getContractFactory("PIONtest");
    pion = await upgrades.deployProxy(PIONtest, []);
    await pion.deployed();

    const PIONlpTest = await ethers.getContractFactory("PIONlpTest");
    pionLp = await PIONlpTest.connect(deployer).deploy();
    await pionLp.deployed();

    const BondedPION = await ethers.getContractFactory("BondedPION");
    bondedPion = await upgrades.deployProxy(BondedPION, [
      pion.address,
      treasury.address,
    ]);
    await bondedPion.deployed();

    const MuonNodeManager = await ethers.getContractFactory("MuonNodeManager");
    nodeManager = await upgrades.deployProxy(MuonNodeManager, []);
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
    ]);
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
        [pion.address, pionLp.address],
        [muonTokenMultiplier, muonLpTokenMultiplier]
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

    await bondedPion.connect(deployer).whitelistTokens([pionLp.address]);

    await nodeStaking.connect(daoRole).setTierMaxStakeAmount(1, tier1MaxStake);
    await nodeStaking.connect(daoRole).setTierMaxStakeAmount(2, tier2MaxStake);
    await nodeStaking.connect(daoRole).setTierMaxStakeAmount(3, tier3MaxStake);

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.ADMIN_ROLE(), nodeStaking.address);

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.DAO_ROLE(), daoRole.address);

    await pion.connect(deployer).mint(rewardRole.address, ONE.mul(2000000));

    await mintBondedPion(ONE.mul(1000), ONE.mul(1000), staker1);
    await bondedPion.connect(staker1).approve(nodeStaking.address, 1);
    await nodeStaking.connect(staker1).addMuonNode(node1.address, peerId1, 1);
    
    //await nodeStaking.connect(daoRole).setMuonNodeTier(staker1.address, tier1);

    const TierSetter = await ethers.getContractFactory("TierSetter");
    tierSetter = await TierSetter.connect(deployer).deploy(
      nodeStaking.address,
      signer.address
    );
    await tierSetter.deployed();
    await nodeStaking.connect(deployer).grantRole(
      await nodeStaking.DAO_ROLE(), tierSetter.address
    );

    await mintBondedPion(ONE.mul(1000), ONE.mul(500), staker2);
    await bondedPion.connect(staker2).approve(nodeStaking.address, 2);
    await nodeStaking.connect(staker2).addMuonNode(node2.address, peerId2, 2);
    // await nodeStaking.connect(daoRole).setMuonNodeTier(staker2.address, tier2);
  });

  const mintBondedPion = async (pionAmount, pionLpAmount, _to) => {
    await pion.connect(deployer).mint(_to.address, pionAmount);
    await pion.connect(_to).approve(bondedPion.address, pionAmount);

    await pionLp.connect(deployer).mint(_to.address, pionLpAmount);
    await pionLp.connect(_to).approve(bondedPion.address, pionLpAmount);

    const tx = await bondedPion
      .connect(_to)
      .mintAndLock(
        [pion.address, pionLp.address],
        [pionAmount, pionLpAmount],
        _to.address
      );
    const receipt = await tx.wait();
    const tokenId = receipt.events[0].args.tokenId.toNumber();
    return tokenId;
  };

  describe("set tier", function () {
    it("should successfully set tier", async function () {
      var node = await nodeManager.stakerAddressInfo(staker1.address);
      expect(node.tier).eq(0);

      await tierSetter.setTier(staker1.address, tier3, Date.now(), '0x00');
      node = await nodeManager.stakerAddressInfo(staker1.address);
      expect(node.tier).eq(tier3);

    });
  });

});
