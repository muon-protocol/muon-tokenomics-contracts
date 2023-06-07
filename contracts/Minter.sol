// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IToken.sol";

/*
    To Do:
    - review the contract
*/

contract Minter is Initializable, OwnableUpgradeable, PausableUpgradeable {
    IToken public pion;
    address public staking;
    uint256 public mintPeriod;
    uint256 public mintAmount;

    uint256 public lastMintTimestamp;

    function initialize(
        address _pion,
        address _staking,
        uint256 _mintPeriod,
        uint256 _mintAmount
    ) external initializer {
        __Pausable_init();
        __Ownable_init();

        require(_pion != address(0) && _staking != address(0), "Zero Address");

        pion = IToken(_pion);
        staking = _staking;
        mintPeriod = _mintPeriod;
        mintAmount = _mintAmount;
    }

    function setStaking(address _staking) external onlyOwner {
        require(_staking != address(0), "Zero Address");
        staking = _staking;

        emit StakingUpdated(_staking);
    }

    function setMintPeriod(uint256 _mintPeriod) external onlyOwner {
        mintPeriod = _mintPeriod;

        emit MintPeriodUpdated(_mintPeriod);
    }

    function setMintAmount(uint256 _mintAmount) external onlyOwner {
        mintAmount = _mintAmount;

        emit MintAmountUpdated(_mintAmount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint() external whenNotPaused {
        // only trigger if new period
        if (block.timestamp >= lastMintTimestamp + mintPeriod) {
            lastMintTimestamp = block.timestamp;
            pion.mint(staking, mintAmount);
        }
    }

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event StakingUpdated(address staking);
    event MintAmountUpdated(uint256 mintAmount);
    event MintPeriodUpdated(uint256 mintPeriod);
}
