import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PION, TestToken, BonPION } from "../typechain-types";
import { MAX_UINT, deployTestToken, testDeployLocally } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("bonPION", function () {
  let pion: PION, bonPion: BonPION, treasury: string, token: TestToken;
  let admin: SignerWithAddress, user: SignerWithAddress;

  let TRANSFERABLE_ADDRESS_ROLE: string, DEFAULT_ADMIN_ROLE: string;

  before(async () => {
    [admin, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const contracts = await loadFixture(testDeployLocally);
    pion = contracts.pion.connect(user);
    bonPion = contracts.bonPion.connect(user);
    treasury = contracts.treasury;

    token = (await loadFixture(deployTestToken)).connect(user);

    TRANSFERABLE_ADDRESS_ROLE = await bonPion.TRANSFERABLE_ADDRESS_ROLE();
    DEFAULT_ADMIN_ROLE = await bonPion.DEFAULT_ADMIN_ROLE();
  });

  describe("Mint and Lock", async function () {
    it("Should not mint PION by user", async function () {
      const pionAmount = ethers.utils.parseEther("100");
      const minterRole = await pion.MINTER_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${minterRole}`;
      await expect(
        pion.connect(user).mint(user.address, pionAmount)
      ).to.be.revertedWith(revertMSG);
    });

    it("Should not whitelist tokens by user", async function () {
      await expect(
        bonPion.connect(user).whitelistTokens([token.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should whitelist tokens by admin", async function () {
      await bonPion.connect(admin).whitelistTokens([token.address]);

      expect(await bonPion.isTokenWhitelisted(token.address)).eq(true);
      expect(await bonPion.isTokenWhitelisted(pion.address)).eq(true);
    });

    it("Should not whitelist tokens again", async function () {
      await bonPion.connect(admin).whitelistTokens([token.address]);

      expect(await bonPion.isTokenWhitelisted(token.address)).eq(true);
      expect(await bonPion.isTokenWhitelisted(pion.address)).eq(true);

      await expect(
        bonPion.connect(admin).whitelistTokens([token.address])
      ).to.be.revertedWith("Already Whitelisted");
    });

    it("Should mint NFT", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(user.address);
      expect(tokenId).eq(1);
      expect(await bonPion.ownerOf(tokenId)).eq(user.address);
    });

    it("Should lock whitelisted tokens", async function () {
      const tokenId = 1;
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint an NFT for user
      await bonPion.mint(user.address);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      // lock tokens
      await bonPion.lock(
        tokenId,
        [pion.address, token.address],
        [pionAmount, tokenAmount]
      );

      // pion should be burned
      expect(await pion.totalSupply()).eq(0);

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(tokenAmount);

      // NFT locked amounts should be increased
      expect(await bonPion.lockedOf(tokenId, pion.address)).eq(pionAmount);
      expect(await bonPion.lockedOf(tokenId, token.address)).eq(tokenAmount);

      // total locked should be increased
      expect(await bonPion.totalLocked(pion.address)).eq(pionAmount);
      expect(await bonPion.totalLocked(token.address)).eq(tokenAmount);
    });

    it("Should lock underlie NFTs owned by other", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);

      await bonPion.mint(admin.address);
      const tokenAmount = ethers.utils.parseEther("200");

      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required token for user
      await token.connect(admin).mint(user.address, tokenAmount);
      await pion.connect(admin).mint(user.address, tokenAmount.mul(3));

      // approve tokens
      await token.connect(user).approve(bonPion.address, tokenAmount);
      await pion.connect(user).approve(bonPion.address, tokenAmount.mul(3));

      // lock tokens
      await bonPion
        .connect(user)
        .lock(
          tokenId,
          [token.address, pion.address],
          [tokenAmount, tokenAmount.mul(2)]
        );

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(tokenAmount);

      // pion should be burned
      expect(await pion.totalSupply()).eq(tokenAmount.mul(1));

      // NFT locked amounts should be increased
      expect(await bonPion.lockedOf(tokenId, pion.address)).eq(
        tokenAmount.mul(2)
      );
      expect(await bonPion.lockedOf(tokenId, token.address)).eq(tokenAmount);

      // total locked should be increased
      expect(await bonPion.totalLocked(pion.address)).eq(tokenAmount.mul(2));
      expect(await bonPion.totalLocked(token.address)).eq(tokenAmount);
    });

    it("Should not lock for address 0", async function () {
      const tokenAmount = ethers.utils.parseEther("200");
      const zeroAddress = ethers.constants.AddressZero;

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await token.approve(bonPion.address, tokenAmount);

      await expect(
        bonPion.lock(zeroAddress, [token.address], [tokenAmount])
      ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should not lock zero amount tokens or tokens with mismatched lists", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(admin.address);
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      // lock tokens
      await expect(
        bonPion.lock(tokenId, [pion.address, token.address], [pionAmount])
      ).to.be.revertedWith("Length Mismatch");

      await expect(
        bonPion.lock(tokenId, [pion.address, token.address], [pionAmount, 0])
      ).to.be.revertedWith("Cannot Lock Zero Amount");

      await expect(
        bonPion.lock(tokenId, [pion.address, token.address], [0, tokenAmount])
      ).to.be.revertedWith("Cannot Lock Zero Amount");
    });

    it("Should mint and lock tokens", async function () {
      const tokenId = 1;
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      // mint NFT and lock tokens
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );

      // pion should be burned
      expect(await pion.totalSupply()).eq(0);

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(tokenAmount);

      // NFT locked amounts should be increased
      expect(await bonPion.lockedOf(tokenId, pion.address)).eq(pionAmount);
      expect(await bonPion.lockedOf(tokenId, token.address)).eq(tokenAmount);

      // total locked should be increased
      expect(await bonPion.totalLocked(pion.address)).eq(pionAmount);
      expect(await bonPion.totalLocked(token.address)).eq(tokenAmount);
    });

    it("Shouldn't lock not whitelisted tokens", async function () {
      await expect(
        bonPion.mintAndLock(
          [token.address],
          [ethers.utils.parseEther("1")],
          user.address
        )
      ).to.be.revertedWith("Not Whitelisted");
    });
  });

  describe("Split and Merge", async function () {
    const tokenIdA = 1;
    const tokenIdB = 2;

    const pionAmount = ethers.utils.parseEther("100");
    const tokenAmount = ethers.utils.parseEther("200");

    beforeEach(async () => {
      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, MAX_UINT);
      await token.connect(admin).mint(user.address, MAX_UINT);

      // approve tokens to bonPion
      await pion.approve(bonPion.address, MAX_UINT);
      await token.approve(bonPion.address, MAX_UINT);
    });

    it("Should merge NFTs", async function () {
      // mint and lock NFTs
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );
      await bonPion.mintAndLock([token.address], [tokenAmount], user.address);

      // merge NFTs
      await bonPion.merge(tokenIdA, tokenIdB);

      // tokenIdA should be burnt
      await expect(bonPion.ownerOf(tokenIdA)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // tokenIdB locked amounts should be increased
      expect(await bonPion.lockedOf(tokenIdB, pion.address)).eq(pionAmount);
      expect(await bonPion.lockedOf(tokenIdB, token.address)).eq(
        tokenAmount.mul(2)
      );
    });

    it("Should not merge with burned NFTs", async function () {
      // mint and lock NFTs
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );
      await bonPion.mintAndLock([token.address], [tokenAmount], user.address);

      await bonPion.connect(user).burn(tokenIdB);

      // merge NFTs
      await expect(bonPion.merge(tokenIdA, tokenIdB)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });

    it("Should not merge not owned NFTs", async function () {
      // mint tokenIdA for admin
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        admin.address
      );
      // mint tokenIdB for user
      await bonPion.mintAndLock([token.address], [tokenAmount], user.address);

      // merge NFTs should fail
      await expect(bonPion.merge(tokenIdA, tokenIdB)).to.be.revertedWith(
        "Not Owned"
      );
    });

    it("Should split NFT", async function () {
      const pionSplitAmounts = [pionAmount, pionAmount.div(2), 0];
      const tokenSplitAmounts = [0, tokenAmount.div(2), tokenAmount];

      for (let i = 0; i < pionSplitAmounts.length; i++) {
        // mint NFT
        const tokenId = await bonPion.callStatic.mintAndLock(
          [pion.address, token.address],
          [pionAmount, tokenAmount],
          user.address
        );
        await bonPion.mintAndLock(
          [pion.address, token.address],
          [pionAmount, tokenAmount],
          user.address
        );

        // split NFT
        await bonPion.split(
          tokenId,
          [pion.address, token.address],
          [pionSplitAmounts[i], tokenSplitAmounts[i]]
        );
        const newTokenId = tokenId.add(1);

        // tokenId locked amounts should be decreased
        expect(await bonPion.lockedOf(tokenId, pion.address)).eq(
          pionAmount.sub(pionSplitAmounts[i])
        );
        expect(await bonPion.lockedOf(tokenId, token.address)).eq(
          tokenAmount.sub(tokenSplitAmounts[i])
        );

        // newTokenId should be minted
        expect(await bonPion.ownerOf(newTokenId)).eq(user.address);

        // newTokenId locked amounts should be correct
        expect(await bonPion.lockedOf(newTokenId, pion.address)).eq(
          pionSplitAmounts[i]
        );
        expect(await bonPion.lockedOf(newTokenId, token.address)).eq(
          tokenSplitAmounts[i]
        );
      }
    });

    it("Should not split NFT with amounts more than locked amounts", async function () {
      const tokenId = 1;

      // mint NFT
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );

      // split NFT
      await expect(
        bonPion.split(
          tokenId,
          [pion.address, token.address],
          [pionAmount, tokenAmount.add(1)]
        )
      ).to.be.revertedWith("Insufficient Locked Amount");
    });
  });

  describe("Transfer", async function () {
    it("Should whitelist transfers by admin", async function () {
      await bonPion
        .connect(admin)
        .grantRole(TRANSFERABLE_ADDRESS_ROLE, user.address);
      expect(await bonPion.hasRole(TRANSFERABLE_ADDRESS_ROLE, user.address)).eq(
        true
      );
    });

    it("Should whitelist transfers by user", async function () {
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;
      await expect(
        bonPion.connect(user).grantRole(TRANSFERABLE_ADDRESS_ROLE, user.address)
      ).to.be.revertedWith(revertMSG);
    });

    it("Should whitelisted transfers send/receive NFTs", async function () {
      const tokenId = 1;
      // minte NFT
      await bonPion.mint(user.address);

      // whitelist user
      await bonPion
        .connect(admin)
        .grantRole(TRANSFERABLE_ADDRESS_ROLE, user.address);

      // transfer from user to admin
      await bonPion["safeTransferFrom(address,address,uint256)"](
        user.address,
        admin.address,
        tokenId
      );
      expect(await bonPion.ownerOf(tokenId)).eq(admin.address);

      // transfer from admin to user
      await bonPion
        .connect(admin)
        ["safeTransferFrom(address,address,uint256)"](
          admin.address,
          user.address,
          tokenId
        );
      expect(await bonPion.ownerOf(tokenId)).eq(user.address);
    });

    it("Shouldn't non-whitelisted transfers send/receive NFTs", async function () {
      const tokenId = 1;
      await bonPion.mint(user.address);
      await expect(
        bonPion["safeTransferFrom(address,address,uint256)"](
          user.address,
          admin.address,
          tokenId
        )
      ).to.be.revertedWith("Transfer is Limited");
    });

    it("Shouldn't not allow anyone but admin enable public transfer", async function () {
      await expect(
        bonPion.connect(user).setPublicTransfer(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should non-whitelisted transfers send/receive NFTs when public transfer is enabled", async function () {
      const tokenId = 1;
      // minte NFT
      await bonPion.mint(user.address);

      await bonPion.connect(admin).setPublicTransfer(true);

      // transfer from user to admin
      await bonPion["safeTransferFrom(address,address,uint256)"](
        user.address,
        admin.address,
        tokenId
      );
      expect(await bonPion.ownerOf(tokenId)).eq(admin.address);

      // transfer from admin to user
      await bonPion
        .connect(admin)
        ["safeTransferFrom(address,address,uint256)"](
          admin.address,
          user.address,
          tokenId
        );
      expect(await bonPion.ownerOf(tokenId)).eq(user.address);
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

    it("Should not pause and unpause bonPION by user", async function () {
      await expect(bonPion.connect(user).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await bonPion.connect(admin).pause();

      await expect(bonPion.connect(user).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
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

    it("Should pause and unpause bonPION", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(user.address);
      expect(await bonPion.ownerOf(tokenId)).eq(user.address);

      await bonPion.connect(admin).pause();

      await expect(bonPion.connect(user).mint(user.address)).to.be.revertedWith(
        "Pausable: paused"
      );
      await bonPion
        .connect(admin)
        .grantRole(TRANSFERABLE_ADDRESS_ROLE, user.address);
      await expect(
        bonPion["safeTransferFrom(address,address,uint256)"](
          user.address,
          admin.address,
          tokenId
        )
      ).to.be.revertedWith("Pausable: paused");
      await expect(bonPion.connect(user).burn(tokenId)).to.be.revertedWith(
        "Pausable: paused"
      );

      await bonPion.connect(admin).unpause();

      const tokenId2 = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(user.address);
      expect(await bonPion.ownerOf(tokenId2)).eq(user.address);

      await bonPion["safeTransferFrom(address,address,uint256)"](
        user.address,
        admin.address,
        tokenId
      );
      expect(await bonPion.ownerOf(tokenId)).eq(admin.address);
      expect(await bonPion.ownerOf(tokenId2)).eq(user.address);

      await bonPion.connect(user).burn(tokenId2);
      await expect(bonPion.ownerOf(tokenId2)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });

    it("Should not lock while paused", async function () {
      const tokenId = 1;
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint an NFT for user
      await bonPion.mint(user.address);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      // pause bonPION
      await bonPion.connect(admin).pause();

      // lock tokens
      await expect(
        bonPion.lock(
          tokenId,
          [pion.address, token.address],
          [pionAmount, tokenAmount]
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not lock PION while PION is paused but lock other tokens", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(admin.address);
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      await pion.connect(admin).pause();

      // mint NFT and lock tokens
      await expect(
        bonPion.lock(
          tokenId,
          [pion.address, token.address],
          [pionAmount, tokenAmount]
        )
      ).to.be.revertedWith("Pausable: paused");

      await expect(
        bonPion.lock(tokenId, [pion.address], [pionAmount])
      ).to.be.revertedWith("Pausable: paused");

      // pion should not be burned
      expect(await pion.totalSupply()).eq(pionAmount);

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(0);

      // NFT locked amounts should be increased
      expect(await bonPion.lockedOf(tokenId, pion.address)).eq(0);
      expect(await bonPion.lockedOf(tokenId, token.address)).eq(0);

      // total locked should be increased
      expect(await bonPion.totalLocked(pion.address)).eq(0);
      expect(await bonPion.totalLocked(token.address)).eq(0);

      await bonPion.lock(tokenId, [token.address], [tokenAmount]);

      expect(await token.balanceOf(treasury)).eq(tokenAmount);
      expect(await bonPion.lockedOf(tokenId, token.address)).eq(tokenAmount);
      expect(await bonPion.totalLocked(token.address)).eq(tokenAmount);
    });

    it("Should not mint and lock while paused", async function () {
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount);
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount);
      await token.approve(bonPion.address, tokenAmount);

      await bonPion.connect(admin).pause();

      // mint NFT and lock tokens
      await expect(
        bonPion.mintAndLock(
          [pion.address, token.address],
          [pionAmount, tokenAmount],
          user.address
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not merge NFTs while paused", async function () {
      const tokenIdA = 1;
      const tokenIdB = 2;

      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, MAX_UINT);
      await token.connect(admin).mint(user.address, MAX_UINT);

      // approve tokens to bonPion
      await pion.approve(bonPion.address, MAX_UINT);
      await token.approve(bonPion.address, MAX_UINT);

      // mint and lock NFTs
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );
      await bonPion.mintAndLock([token.address], [tokenAmount], user.address);

      // // pause
      await bonPion.connect(admin).pause();

      // // merge NFTs
      await expect(bonPion.merge(tokenIdA, tokenIdB)).to.be.revertedWith(
        "Pausable: paused"
      );

      // tokenIdA should not be burnt
      expect(await bonPion.ownerOf(tokenIdA)).eq(user.address);
    });

    it("Should split NFT", async function () {
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, MAX_UINT);
      await token.connect(admin).mint(user.address, MAX_UINT);

      // approve tokens to bonPion
      await pion.approve(bonPion.address, MAX_UINT);
      await token.approve(bonPion.address, MAX_UINT);

      const pionSplitAmounts = [pionAmount, pionAmount.div(2), 0];
      const tokenSplitAmounts = [0, tokenAmount.div(2), tokenAmount];

      // mint NFT
      const tokenId = await bonPion.callStatic.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );
      await bonPion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      );

      // pause
      await bonPion.connect(admin).pause();

      // split NFT
      await expect(
        bonPion.split(
          tokenId,
          [pion.address, token.address],
          [pionAmount.div(2), tokenAmount.div(2)]
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Set Treasury", async function () {
    it("Should not set 0 address as treasury", async function () {
      const zeroAddress = ethers.constants.AddressZero;
      await expect(
        bonPion.connect(admin).setTreasury(zeroAddress)
      ).to.be.revertedWith("Zero Address");
    });

    it("Should not set treasury by user", async function () {
      await expect(
        bonPion.connect(user).setTreasury(user.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should set treasury by admin", async function () {
      await bonPion.connect(admin).setTreasury(user.address);
      expect(await bonPion.treasury()).eq(user.address);
    });
  });

  describe("Get Locked Of", async function () {
    it("Should return a list of tokens' locked amount", async function () {
      const tokenId = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(user.address);
      const tokenId2 = await bonPion.callStatic.mint(user.address);
      await bonPion.mint(user.address);
      const pionAmount = ethers.utils.parseEther("100");
      const tokenAmount = ethers.utils.parseEther("200");

      // whitelist token
      await bonPion.connect(admin).whitelistTokens([token.address]);

      // mint an NFT for user
      await bonPion.mint(user.address);

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount.mul(3));
      await token.connect(admin).mint(user.address, tokenAmount);

      // approve tokens
      await pion.approve(bonPion.address, pionAmount.mul(3));
      await token.approve(bonPion.address, tokenAmount);

      // lock tokens
      await bonPion.lock(
        tokenId,
        [pion.address, token.address],
        [pionAmount, tokenAmount]
      );

      await bonPion.lock(tokenId2, [pion.address], [pionAmount.mul(2)]);
      expect(await bonPion.getLockedOf(tokenId, [pion.address])).to.deep.equal([
        pionAmount,
      ]);
      expect(await bonPion.getLockedOf(tokenId, [token.address])).to.deep.equal(
        [tokenAmount]
      );
      expect(
        await bonPion.getLockedOf(tokenId, [pion.address, token.address])
      ).to.deep.equal([pionAmount, tokenAmount]);

      expect(await bonPion.getLockedOf(tokenId2, [pion.address])).to.deep.equal(
        [pionAmount.mul(2)]
      );
      expect(
        await bonPion.getLockedOf(tokenId2, [token.address])
      ).to.deep.equal([0]);
      expect(
        await bonPion.getLockedOf(tokenId2, [pion.address, token.address])
      ).to.deep.equal([pionAmount.mul(2), 0]);
    });
  });
});
