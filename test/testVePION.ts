import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { PION, TestToken, VePION } from "../typechain-types";
import { MAX_UINT, deployTestToken, testDeployLocally } from "../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("vePION", function () {
  let pion: PION, vePion: VePION, treasury: string, token: TestToken;
  let admin: SignerWithAddress, user: SignerWithAddress;


  before(async () => {
    [admin, user] = await ethers.getSigners()
  })

  beforeEach(async () => {
    const contracts = await loadFixture(testDeployLocally)
    pion = contracts.pion.connect(user)
    vePion = contracts.vePion.connect(user)
    treasury = contracts.treasury

    token = (await loadFixture(deployTestToken)).connect(user)
  })

  describe("Mint and Lock", async function () {
    it("Should not mint PION by user", async function () {
      const pionAmount = ethers.utils.parseEther('100')
      const minterRole = await pion.MINTER_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${minterRole}`;
      await expect(pion.connect(user).mint(user.address, pionAmount)).to.be.revertedWith(revertMSG);
    });

    it("Should not whitelist tokens by user", async function () {
      await expect(vePion.connect(user).whitelistTokens([token.address])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should whitelist tokens by admin", async function () {
      await vePion.connect(admin).whitelistTokens([token.address])

      expect(await vePion.isTokenWhitelisted(token.address)).eq(true)
      expect(await vePion.isTokenWhitelisted(pion.address)).eq(true)
    });

    it("Should mint NFT", async function () {
      const tokenId = await vePion.callStatic.mint(user.address)
      await vePion.mint(user.address)
      expect(tokenId).eq(1)
      expect(await vePion.ownerOf(tokenId)).eq(user.address)
    });

    it("Should lock whitelisted tokens", async function () {
      const tokenId = 1
      const pionAmount = ethers.utils.parseEther('100')
      const tokenAmount = ethers.utils.parseEther('200')

      // whitelist token
      await vePion.connect(admin).whitelistTokens([token.address])

      // mint an NFT for user
      await vePion.mint(user.address)

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount)
      await token.connect(admin).mint(user.address, tokenAmount)

      // approve tokens
      await pion.approve(vePion.address, pionAmount)
      await token.approve(vePion.address, tokenAmount)

      // lock tokens
      await vePion.lock(
        tokenId,
        [pion.address, token.address],
        [pionAmount, tokenAmount]
      )

      // pion should be burned
      expect(await pion.totalSupply()).eq(0)

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(tokenAmount)

      // NFT locked amounts should be increased
      expect(await vePion.lockedOf(tokenId, pion.address)).eq(pionAmount)
      expect(await vePion.lockedOf(tokenId, token.address)).eq(tokenAmount)

      // total locked should be increased
      expect(await vePion.totalLocked(pion.address)).eq(pionAmount)
      expect(await vePion.totalLocked(token.address)).eq(tokenAmount)

    });


    it("Should mint and lock tokens", async function () {
      const tokenId = 1
      const pionAmount = ethers.utils.parseEther('100')
      const tokenAmount = ethers.utils.parseEther('200')

      // whitelist token
      await vePion.connect(admin).whitelistTokens([token.address])

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount)
      await token.connect(admin).mint(user.address, tokenAmount)

      // approve tokens
      await pion.approve(vePion.address, pionAmount)
      await token.approve(vePion.address, tokenAmount)

      // mint NFT and lock tokens
      await vePion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      )

      // pion should be burned
      expect(await pion.totalSupply()).eq(0)

      // token should be transfered to treasury
      expect(await token.balanceOf(treasury)).eq(tokenAmount)

      // NFT locked amounts should be increased
      expect(await vePion.lockedOf(tokenId, pion.address)).eq(pionAmount)
      expect(await vePion.lockedOf(tokenId, token.address)).eq(tokenAmount)

      // total locked should be increased
      expect(await vePion.totalLocked(pion.address)).eq(pionAmount)
      expect(await vePion.totalLocked(token.address)).eq(tokenAmount)


    });

    it("Shouldn't lock not whitelisted tokens", async function () {
      await expect(
        vePion.mintAndLock(
          [token.address],
          [ethers.utils.parseEther('1')],
          user.address
        )
      ).to.be.revertedWith("Not Whitelisted")
    });
  })

  describe("Split and Merge", async function () {
    const tokenIdA = 1
    const tokenIdB = 2

    const pionAmount = ethers.utils.parseEther('100')
    const tokenAmount = ethers.utils.parseEther('200')

    beforeEach(async () => {
      // whitelist token
      await vePion.connect(admin).whitelistTokens([token.address])

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, MAX_UINT)
      await token.connect(admin).mint(user.address, MAX_UINT)

      // approve tokens to vePion
      await pion.approve(vePion.address, MAX_UINT)
      await token.approve(vePion.address, MAX_UINT)
    })

    it("Should merge NFTs", async function () {
      // mint and lock NFTs
      await vePion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      )
      await vePion.mintAndLock(
        [token.address],
        [tokenAmount],
        user.address
      )

      // merge NFTs
      await vePion.merge(tokenIdA, tokenIdB)

      // tokenIdA should be burnt
      await expect(vePion.ownerOf(tokenIdA)).to.be.revertedWith("ERC721: invalid token ID")

      // tokenIdB locked amounts should be increased
      expect(await vePion.lockedOf(tokenIdB, pion.address)).eq(pionAmount)
      expect(await vePion.lockedOf(tokenIdB, token.address)).eq(tokenAmount.mul(2))
    });

    it("Should not merge not owned NFTs", async function () {
      // mint tokenIdA for admin
      await vePion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        admin.address
      )
      // mint tokenIdB for user
      await vePion.mintAndLock(
        [token.address],
        [tokenAmount],
        user.address
      )

      // merge NFTs should fail
      await expect(vePion.merge(tokenIdA, tokenIdB)).to.be.revertedWith("Not Owned")
    });

    it("Should split NFT", async function () {
      const pionSplitAmounts = [pionAmount, pionAmount.div(2), 0]
      const tokenSplitAmounts = [0, tokenAmount.div(2), tokenAmount]

      for (let i = 0; i < pionSplitAmounts.length; i++) {
        // mint NFT
        const tokenId = await vePion.callStatic.mintAndLock(
          [pion.address, token.address],
          [pionAmount, tokenAmount],
          user.address
        )
        await vePion.mintAndLock(
          [pion.address, token.address],
          [pionAmount, tokenAmount],
          user.address
        )

        // split NFT
        await vePion.split(
          tokenId,
          [pion.address, token.address],
          [pionSplitAmounts[i], tokenSplitAmounts[i]]
        )
        const newTokenId = tokenId.add(1)

        // tokenId locked amounts should be decreased
        expect(await vePion.lockedOf(tokenId, pion.address)).eq(pionAmount.sub(pionSplitAmounts[i]))
        expect(await vePion.lockedOf(tokenId, token.address)).eq(tokenAmount.sub(tokenSplitAmounts[i]))

        // newTokenId should be minted
        expect(await vePion.ownerOf(newTokenId)).eq(user.address)

        // newTokenId locked amounts should be correct
        expect(await vePion.lockedOf(newTokenId, pion.address)).eq(pionSplitAmounts[i])
        expect(await vePion.lockedOf(newTokenId, token.address)).eq(tokenSplitAmounts[i])

      }
    });

    it("Should not split NFT with amounts more than locked amounts", async function () {
      const tokenId = 1

      // mint NFT
      await vePion.mintAndLock(
        [pion.address, token.address],
        [pionAmount, tokenAmount],
        user.address
      )

      // split NFT
      await expect(vePion.split(
        tokenId,
        [pion.address, token.address],
        [pionAmount, tokenAmount.add(1)]
      )).to.be.revertedWith("Insufficient Locked Amount")

    });
  })

  describe("Transfer", async function () {
    it("Should whitelist transfers by admin", async function () {
      await vePion.connect(admin).whitelistTransferFor([user.address])
      expect(await vePion.isTransferWhitelisted(user.address)).eq(true)
    });

    it("Should whitelist transfers by user", async function () {
      await expect(vePion.connect(user).whitelistTransferFor([user.address])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should whitelisted transfers send/receive NFTs", async function () {
      const tokenId = 1
      // minte NFT
      await vePion.mint(user.address)

      // whitelist user
      await vePion.connect(admin).whitelistTransferFor([user.address])

      // transfer from user to admin
      await vePion["safeTransferFrom(address,address,uint256)"](user.address, admin.address, tokenId)
      expect(await vePion.ownerOf(tokenId)).eq(admin.address)

      // transfer from admin to user
      await vePion.connect(admin)["safeTransferFrom(address,address,uint256)"](admin.address, user.address, tokenId)
      expect(await vePion.ownerOf(tokenId)).eq(user.address)
    });

    it("Shouldn't not whitelisted transfers send/receive NFTs", async function () {
      const tokenId = 1
      await vePion.mint(user.address)
      await expect(vePion["safeTransferFrom(address,address,uint256)"](user.address, admin.address, tokenId)).to.be.revertedWith("Transfer Limited")
    });
  })
  describe("Pause and Unpaused", async function () {
    it("Should not pause and unpause PION by user", async function () {
      const pionAmount = ethers.utils.parseEther('100')

      await pion.connect(admin).mint(user.address, pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);

      const pauserRole = await pion.PAUSER_ROLE();
      const revertMSG = `AccessControl: account ${user.address.toLowerCase()} is missing role ${pauserRole}`;
      await expect(pion.connect(user).pause()).to.be.revertedWith(revertMSG);

      await pion.connect(admin).pause();

      await expect(pion.connect(user).unpause()).to.be.revertedWith(revertMSG);
    });
    it("Should not pause and unpause VePION by user", async function () {
      await expect(vePion.connect(user).pause()).to.be.revertedWith("Ownable: caller is not the owner");

      await vePion.connect(admin).pause();

      await expect(vePion.connect(user).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should pause and unpause PION", async function () {
      const pionAmount = ethers.utils.parseEther('100')

      await pion.connect(admin).mint(user.address, pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);
      await pion.connect(admin).pause();
      
      await expect(pion.connect(admin).mint(user.address, pionAmount)).to.be.revertedWith("Pausable: paused");
      await expect(pion.connect(user).transfer(admin.address, pionAmount)).to.be.revertedWith("Pausable: paused");
      await expect(pion.connect(user).burn(pionAmount)).to.be.revertedWith("Pausable: paused");

      await pion.connect(admin).unpause();

      await pion.connect(admin).mint(user.address, pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount.mul(2));

      await pion.connect(user).transfer(admin.address, pionAmount);
      expect(await pion.connect(admin).balanceOf(admin.address)).eq(pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(pionAmount);

      await pion.connect(user).burn(pionAmount);
      expect(await pion.connect(user).balanceOf(user.address)).eq(0);
    });

    it("Should pause and unpause VePION", async function () {
      const tokenId = await vePion.callStatic.mint(user.address)
      await vePion.mint(user.address)
      expect(await vePion.ownerOf(tokenId)).eq(user.address);
      
      await vePion.connect(admin).pause();
      
      await expect(vePion.connect(user).mint(user.address)).to.be.revertedWith("Pausable: paused");
      await vePion.connect(admin).whitelistTransferFor([user.address])
      await expect(vePion["safeTransferFrom(address,address,uint256)"](user.address, admin.address, tokenId)).to.be.revertedWith("Pausable: paused");
      await expect(vePion.connect(user).burn(tokenId)).to.be.revertedWith("Pausable: paused");

      await vePion.connect(admin).unpause();

      const tokenId2 = await vePion.callStatic.mint(user.address)
      await vePion.mint(user.address)
      expect(await vePion.ownerOf(tokenId2)).eq(user.address);

      await vePion["safeTransferFrom(address,address,uint256)"](user.address, admin.address, tokenId)
      expect(await vePion.ownerOf(tokenId)).eq(admin.address);
      expect(await vePion.ownerOf(tokenId2)).eq(user.address);

      await vePion.connect(user).burn(tokenId2);
      await expect(vePion.ownerOf(tokenId2)).to.be.revertedWith("ERC721: invalid token ID");
    });
  })
  describe("Set Treasury", async function () {
    it("Should not set treasury by user", async function () {
      await expect(vePion.connect(user).setTreasury(user.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should set treasury by admin", async function () {
      await vePion.connect(admin).setTreasury(user.address)
      expect(await vePion.treasury()).eq(user.address);
    });
  })
  describe("Get Locked Of", async function () {
    it("Should return a list of tokens' locked amount", async function () {
      const tokenId = await vePion.callStatic.mint(user.address)
      await vePion.mint(user.address)
      const tokenId2 = await vePion.callStatic.mint(user.address)
      await vePion.mint(user.address)
      const pionAmount = ethers.utils.parseEther('100')
      const tokenAmount = ethers.utils.parseEther('200')

      // whitelist token
      await vePion.connect(admin).whitelistTokens([token.address])

      // mint an NFT for user
      await vePion.mint(user.address)

      // mint required tokens for user
      await pion.connect(admin).mint(user.address, pionAmount.mul(3))
      await token.connect(admin).mint(user.address, tokenAmount)

      // approve tokens
      await pion.approve(vePion.address, pionAmount.mul(3))
      await token.approve(vePion.address, tokenAmount)

      // lock tokens
      await vePion.lock(
        tokenId,
        [pion.address, token.address],
        [pionAmount, tokenAmount]
      )

      await vePion.lock(
        tokenId2,
        [pion.address],
        [pionAmount.mul(2)]
      )
      expect(await vePion.getLockedOf(tokenId, [pion.address])).to.deep.equal([pionAmount]);
      expect(await vePion.getLockedOf(tokenId, [token.address])).to.deep.equal([tokenAmount]);
      expect(await vePion.getLockedOf(tokenId, [pion.address, token.address])).to.deep.equal([pionAmount, tokenAmount]);

      expect(await vePion.getLockedOf(tokenId2, [pion.address])).to.deep.equal([pionAmount.mul(2)]);
      expect(await vePion.getLockedOf(tokenId2, [token.address])).to.deep.equal([0]);
      expect(await vePion.getLockedOf(tokenId2, [pion.address, token.address])).to.deep.equal([pionAmount.mul(2), 0]);
    });
  })
})
