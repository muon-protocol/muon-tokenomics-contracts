import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { MuonNodeManager } from "../typechain/MuonNodeManager";

describe("MuonNodeManager", function () {
  let deployer: Signer;
  let adminRole: Signer;
  let daoRole: Signer;
  let node1: Signer;
  let node2: Signer;
  let node3: Signer;
  let staker1: Signer;
  let staker2: Signer;
  let staker3: Signer;
  let user1: Signer;

  const peerId1 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh1";
  const peerId2 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh2";
  const peerId3 = "QmQ28Fae738pmSuhQPYtsDtwU8pKYPPgf76pSN61T3APh3";

  let nodeManager: MuonNodeManager;

  before(async function () {
    [
      deployer,
      adminRole,
      daoRole,
      node1,
      node2,
      node3,
      staker1,
      staker2,
      staker3,
      user1,
    ] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const MuonNodeManager = await ethers.getContractFactory("MuonNodeManager");
    nodeManager = await upgrades.deployProxy(MuonNodeManager, []);
    await nodeManager.deployed();

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.ADMIN_ROLE(), adminRole.address);

    await nodeManager
      .connect(deployer)
      .grantRole(await nodeManager.DAO_ROLE(), daoRole.address);
  });

  describe("add nodes", function () {
    it("should successfully add Muon nodes", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);
      const node = await nodeManager.nodes(1);
      expect(node.id).eq(1);
      expect(node.nodeAddress).eq(node1.address);
      expect(node.stakerAddress).eq(staker1.address);
      expect(node.peerId).eq(peerId1);
      expect(node.active).to.be.true;
      expect(node.tier).eq(0);
      expect(node.startTime).to.be.greaterThan(0);
      expect(node.endTime).eq(0);
      expect(node.lastEditTime).eq(node.startTime);
    });

    it("should not allow adding a node with a duplicate nodeAddress.", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      await expect(
        nodeManager
          .connect(adminRole)
          .addNode(node1.address, staker2.address, peerId2, true)
      ).to.be.revertedWith("Node address is already registered.");
    });

    it("should not allow adding a node with a duplicate stakerAddress", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      await expect(
        nodeManager
          .connect(adminRole)
          .addNode(node2.address, staker1.address, peerId2, true)
      ).to.be.revertedWith("Staker address is already registered.");
    });
  });

  describe("deactive nodes", function () {
    it("should successfully deactivate an active node", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      await nodeManager.connect(adminRole).deactiveNode(1);
      const node = await nodeManager.nodes(1);
      expect(node.active).eq(false);
      expect(node.endTime).to.not.equal(0);
    });

    it("should not allow deactivating an already deactivated node", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      await nodeManager.connect(adminRole).deactiveNode(1);
      await expect(
        nodeManager.connect(adminRole).deactiveNode(1)
      ).to.be.revertedWith("Node is already deactivated.");
    });

    it("should not allow deactivating a non-existent node", async function () {
      await expect(
        nodeManager.connect(adminRole).deactiveNode(2)
      ).to.be.revertedWith("Node ID not found.");
    });
  });

  describe("get nods", function () {
    it("should retrieve all edited nodes or all nodes", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;

      for (let i = 1; i <= 10; i++) {
        await nodeManager
          .connect(adminRole)
          .addNode(
            ethers.Wallet.createRandom().address,
            ethers.Wallet.createRandom().address,
            `peerId${i}`,
            true
          );
      }

      const targetTimestamp = startTime + 2 * 3600;
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        targetTimestamp,
      ]);

      for (let i = 1; i <= 5; i++) {
        await nodeManager
          .connect(adminRole)
          .addNode(
            ethers.Wallet.createRandom().address,
            ethers.Wallet.createRandom().address,
            `peerId${i}`,
            true
          );
      }

      const nodeId = 1;
      const roleDeployers = ethers.utils.solidityKeccak256(
        ["string"],
        ["deployers"]
      );
      await nodeManager.connect(daoRole).addNodeRole(roleDeployers);
      const roleIdDeployers = await nodeManager.roleIds(roleDeployers);
      await nodeManager.connect(daoRole).setNodeRole(nodeId, roleIdDeployers);
      expect(await nodeManager.nodeHasRole(nodeId, roleDeployers)).to.be.true;

      // get the list of the nodes that were edited in the past hour
      const endTime = (await ethers.provider.getBlock("latest")).timestamp;
      const lastEditTime = endTime - 3600;
      const editedNodesList = await nodeManager.getAllNodes(
        lastEditTime,
        1,
        1000
      );

      expect(editedNodesList).to.have.lengthOf(6);
      const node = editedNodesList[0];
      const nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1]);

      for (let i = 1; i <= 100; i++) {
        await nodeManager
          .connect(adminRole)
          .addNode(
            ethers.Wallet.createRandom().address,
            ethers.Wallet.createRandom().address,
            `peerId${i}`,
            true
          );
      }

      const allNodesList = await nodeManager.getAllNodes(0, 1, 1000);
      expect(allNodesList).to.have.lengthOf(115);

      expect(await nodeManager.lastNodeId()).to.be.equal(115);
    });

    it("should retrieve edited nodes", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;

      for (let i = 1; i <= 108; i++) {
        await nodeManager
          .connect(adminRole)
          .addNode(
            ethers.Wallet.createRandom().address,
            ethers.Wallet.createRandom().address,
            `peerId${i}`,
            true
          );
      }

      const targetTimestamp = startTime + 2 * 3600;
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        targetTimestamp,
      ]);

      const roleDeployers = ethers.utils.solidityKeccak256(
        ["string"],
        ["deployers"]
      );

      for (let i = 1; i <= 102; i++) {
        await nodeManager.setTier(i, 1);

        // to test that it should not return duplicate nodes
        await nodeManager.setTier(i, 2);
      }

      // get the list of the nodes that were edited in the past hour
      const endTime = (await ethers.provider.getBlock("latest")).timestamp;
      const lastEditTime = endTime - 3600;

      const editedNodesList = [];
      let lastIndex = 0;
      while (true) {
        const resp = await nodeManager.getEditedNodes(
          lastEditTime,
          lastIndex,
          50
        );
        editedNodesList.push(...resp.nodesList);
        lastIndex = resp.lastIndex;
        if (lastIndex == 0) {
          break;
        }
      }

      expect(editedNodesList).to.have.lengthOf(102);
    });
  });

  describe("nodeAddressInfo", function () {
    it("should successfully retrieve node information for a valid nodeAddress", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);
      const node = await nodeManager.nodeAddressInfo(node1.address);
      expect(node.id).eq(1);
      expect(node.peerId).eq(peerId1);
    });

    it("should return empty node information for an invalid nodeAddress", async function () {
      const node = await nodeManager.nodeAddressInfo(staker3.address);
      expect(node.id).eq(0);
    });
  });

  describe("stakerAddressInfo", function () {
    it("should successfully retrieve node information for a valid stakerAddress", async function () {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);
      const node = await nodeManager.stakerAddressInfo(staker1.address);
      expect(node.id).eq(1);
      expect(node.peerId).eq(peerId1);
    });

    it("should return empty node information for an invalid stakerAddress", async function () {
      const node = await nodeManager.stakerAddressInfo(node3.address);
      expect(node.id).eq(0);
    });
  });

  describe("node roles", () => {
    it("should not allow unauthorized accounts to add/set/unset node roles' roles", async () => {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);
      const nodeId = 1;
      const role = ethers.utils.solidityKeccak256(["string"], ["poa"]);

      const DAO_ROLE = await nodeManager.DAO_ROLE();
      const revertMSG = `AccessControl: account ${adminRole.address.toLowerCase()} is missing role ${DAO_ROLE}`;
      await expect(
        nodeManager.connect(adminRole).addNodeRole(role)
      ).to.be.revertedWith(revertMSG);

      await nodeManager.connect(daoRole).addNodeRole(role);
      const roleId = await nodeManager.roleIds(role);
      await expect(
        nodeManager.connect(adminRole).setNodeRole(nodeId, roleId)
      ).to.be.revertedWith(revertMSG);

      await expect(
        nodeManager.connect(adminRole).unsetNodeRole(nodeId, roleId)
      ).to.be.revertedWith(revertMSG);
    });

    it("should not allow setting/unsetting roles that have not been added yet", async () => {
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      const nodeId = 1;
      const role = ethers.utils.solidityKeccak256(["string"], ["poa"]);
      const roleId = await nodeManager.roleIds(role);

      await expect(
        nodeManager.connect(daoRole).setNodeRole(nodeId, roleId)
      ).to.be.revertedWith("Invalid role ID.");

      await expect(
        nodeManager.connect(daoRole).unsetNodeRole(nodeId, roleId)
      ).be.revertedWith("Invalid role ID.");
    });

    it("the DAO should be able to add/set node roles", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;

      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      const nodeId = 1;
      const roleDeployers = ethers.utils.solidityKeccak256(
        ["string"],
        ["deployers"]
      );
      await nodeManager.connect(daoRole).addNodeRole(roleDeployers);
      const roleIdDeployers = await nodeManager.roleIds(roleDeployers);
      await nodeManager.connect(daoRole).setNodeRole(nodeId, roleIdDeployers);
      expect(await nodeManager.nodeHasRole(nodeId, roleDeployers)).to.be.true;
      let node = await nodeManager.getNode(nodeId);
      let nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles.includes(1)).to.be.true;

      const rolePoa = ethers.utils.solidityKeccak256(["string"], ["poa"]);
      await nodeManager.connect(daoRole).addNodeRole(rolePoa);
      const roleIdPoa = await nodeManager.roleIds(rolePoa);
      await nodeManager.connect(daoRole).setNodeRole(nodeId, roleIdPoa);
      expect(await nodeManager.nodeHasRole(nodeId, rolePoa)).to.be.true;

      const nodeRoleSetEvents = await nodeManager.queryFilter(
        nodeManager.filters.NodeRoleSet(nodeId, null)
      );

      expect(nodeRoleSetEvents[0].args.nodeId).eq(nodeId);
      expect(nodeRoleSetEvents[0].args.roleId).eq(roleIdDeployers);

      expect(nodeRoleSetEvents[1].args.nodeId).eq(nodeId);
      expect(nodeRoleSetEvents[1].args.roleId).eq(roleIdPoa);

      const nodes = await nodeManager.getAllNodes(0, 1, 1000);
      node = nodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1, 2]);

      const editedNodes = await nodeManager.getAllNodes(startTime, 1, 1000);
      node = editedNodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1, 2]);
    });

    it("the DAO should be able to unset node roles", async () => {
      const startTime = (await ethers.provider.getBlock("latest")).timestamp;

      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      const nodeId = 1;
      const roleDeployers = ethers.utils.solidityKeccak256(
        ["string"],
        ["deployers"]
      );
      await nodeManager.connect(daoRole).addNodeRole(roleDeployers);
      const roleIdDeployers = await nodeManager.roleIds(roleDeployers);
      await nodeManager.connect(daoRole).setNodeRole(nodeId, roleIdDeployers);
      expect(await nodeManager.nodeHasRole(nodeId, roleDeployers)).to.be.true;

      const rolePoa = ethers.utils.solidityKeccak256(["string"], ["poa"]);
      await nodeManager.connect(daoRole).addNodeRole(rolePoa);
      const roleIdPoa = await nodeManager.roleIds(rolePoa);
      await nodeManager.connect(daoRole).setNodeRole(nodeId, roleIdPoa);
      expect(await nodeManager.nodeHasRole(nodeId, rolePoa)).to.be.true;

      let node = await nodeManager.getNode(nodeId);
      let nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1, 2]);

      let nodes = await nodeManager.getAllNodes(0, 1, 1000);
      node = nodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1, 2]);

      let editedNodes = await nodeManager.getAllNodes(startTime, 1, 1000);
      node = editedNodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([1, 2]);

      await nodeManager.connect(daoRole).unsetNodeRole(nodeId, roleIdDeployers);
      expect(await nodeManager.nodeHasRole(nodeId, roleDeployers)).to.be.false;
      expect(await nodeManager.nodeHasRole(nodeId, rolePoa)).to.be.true;

      node = await nodeManager.getNode(nodeId);
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles.includes(1)).to.be.false;
      expect(nodeRoles.includes(2)).to.be.true;

      nodes = await nodeManager.getAllNodes(0, 1, 1000);
      node = nodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([2]);

      editedNodes = await nodeManager.getAllNodes(startTime, 1, 1000);
      node = editedNodes[0];
      nodeRoles = node.roles.map((role) => role.toNumber());
      expect(nodeRoles).to.deep.equal([2]);
    });

    it("should retrieve contract information and configuration values", async () => {
      // Add a node
      await nodeManager
        .connect(adminRole)
        .addNode(node1.address, staker1.address, peerId1, true);

      // Add a node role
      const roleDeployers = ethers.utils.solidityKeccak256(
        ["string"],
        ["deployers"]
      );
      await nodeManager.connect(daoRole).addNodeRole(roleDeployers);

      // Set the config values
      const configKeys = ["key1", "key2", "key3"];
      const configValues = ["value1", "value2", "value3"];
      for (let i = 0; i < configKeys.length; i++) {
        await nodeManager.setConfig(configKeys[i], configValues[i]);
      }

      const info = await nodeManager.getInfo(configKeys);
      expect(info[0]).to.equal(await nodeManager.lastUpdateTime());
      expect(info[1]).to.equal(await nodeManager.lastNodeId());
      expect(info[2]).to.equal(await nodeManager.lastRoleId());
      expect(info[3]).to.deep.equal(configValues);
    });
  });

  describe("node tier", function () {
    it("the DAO should be able to set node tier", async function () {
      const nodeId = 1;
      let node = await nodeManager.nodes(nodeId);
      expect(node.tier).eq(0);

      const newTier = 2;
      await nodeManager.setTier(nodeId, newTier);
      node = await nodeManager.nodes(nodeId);
      expect(node.tier).eq(newTier);
    });
  });
});
