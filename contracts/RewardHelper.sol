// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMuonNodeStaking {
    function periodFinish() external view returns (uint256);
    function muonToken() external view returns (address);
    function distributeRewards(uint256 reward) external;
}

/// @title RewardHelper
/// @notice Permissionlessly triggers reward distribution to MuonNodeStaking once each period ends.
contract RewardHelper is Ownable {

    IMuonNodeStaking public muonNodeStaking;
    uint256 public rewardAmount;

    event RewardsDistributed(address indexed caller, uint256 amount);

    /// @notice Initializes the contract with the staking address and reward amount.
    /// @param _owner Address of the contract owner.
    /// @param _muonNodeStaking Address of the MuonNodeStaking contract.
    /// @param _rewardAmount Reward tokens to distribute each period.
    constructor(address _owner,address _muonNodeStaking, uint256 _rewardAmount) {
        _transferOwnership(_owner);
        muonNodeStaking = IMuonNodeStaking(_muonNodeStaking);
        rewardAmount = _rewardAmount;
    }

    /// @notice Distributes rewards to MuonNodeStaking if the current reward period has finished.
    /// @dev Anyone may call this. Reverts if the period has not yet ended.
    function distributeRewards() external {
        require(block.timestamp >= muonNodeStaking.periodFinish(), "Period not finished");
        muonNodeStaking.distributeRewards(rewardAmount);
        emit RewardsDistributed(msg.sender, rewardAmount);
    }

    /// @notice Updates the MuonNodeStaking contract address.
    /// @param _muonNodeStaking New MuonNodeStaking address.
    function setMuonNodeStaking(address _muonNodeStaking) external onlyOwner {
        muonNodeStaking = IMuonNodeStaking(_muonNodeStaking);
    }

    /// @notice Updates the reward amount distributed each period.
    /// @param _rewardAmount New reward amount.
    function setRewardAmount(uint256 _rewardAmount) external onlyOwner {
        rewardAmount = _rewardAmount;
    }
}
