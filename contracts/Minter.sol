// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IPION.sol";

/*
    To Do:
    - review the contract
    - write tests
    - add required events
*/

contract Minter is Initializable, OwnableUpgradeable, PausableUpgradeable {
    IPION public pion;
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

        pion = IPION(_pion);
        staking = _staking;
        mintPeriod = _mintPeriod;
        mintAmount = _mintAmount;
    }

    function setStaking(address _staking) external onlyOwner {
        require(_staking != address(0), "Zero Address");
        staking = _staking;
    }

    function setMintPeriod(uint256 _mintPeriod) external onlyOwner {
        mintPeriod = _mintPeriod;
    }

    function setMintAmount(uint256 _mintAmount) external onlyOwner {
        mintAmount = _mintAmount;
    }

    function mint() external whenNotPaused {
        // only trigger if new period
        if (block.timestamp >= lastMintTimestamp + mintPeriod) {
            lastMintTimestamp = block.timestamp;
            pion.mint(staking, mintAmount);
        }
    }
}
