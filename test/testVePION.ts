import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PION, VePION } from "../typechain-types";
import { deploy } from "../scripts/utils";

describe("vePION", function () {
  let pion: PION, vePion: VePION

  beforeEach(async () => {
    const contracts = await loadFixture(deploy)
    pion = contracts.pion
    vePion = contracts.vePion
  })

  describe("Mint and Lock", async function () {
    it("Should whitelist tokens", async function () { });

    it("Should mint NFT", async function () { });

    it("Should lock whitelisted tokens", async function () { });

    it("Shouldn't lock not whitelisted tokens", async function () { });

    it("Should mint and lock tokens", async function () { });
  })

  describe("Split and Merge", async function () {
    it("Should merge NFTs", async function () { });

    it("Should not merge not owned NFTs", async function () { });

    it("Should split NFT", async function () { });

    it("Should not split NFT with amounts more than locked amounts", async function () { });
  })

  describe("Transfer", async function () {
    it("Should whitelist transfers", async function () { });

    it("Should whitelisted transfers send/receive NFTs", async function () { });

    it("Shouldn't not whitelisted transfers send/receive NFTs", async function () { });
  })

})
