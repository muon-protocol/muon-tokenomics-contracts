// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MuonVestingManager is Ownable {
    using SafeERC20 for IERC20;

    struct User {
        uint256 totalAllocation;
        uint256 released;
    }

    address baseToken;

    uint256 public immutable start;
    uint256 public immutable duration;

    mapping(address => User) public users;

    event TokenReleased(address indexed user, uint256 amount);

    /**
     * @dev Sets the baseToken, the start timestamp and the vesting duration (in seconds) of the vesting program
     */
    constructor(
        address _baseToken,
        uint256 _startTimestamp,
        uint256 _durationSeconds
    ) Ownable() {
        baseToken = _baseToken;
        start = _startTimestamp;
        duration = _durationSeconds;
    }

    function bulkImport(
        address[] memory _addrs,
        uint256[] memory _balances
    ) external onlyOwner {
        require(_addrs.length == _balances.length, "Length mismatch");
        
        uint256 len = _addrs.length;
        for (uint256 i = 0; i < len; i++) {
            address addr = _addrs[i];
            users[addr] = User(
                _balances[i],
                0
            );
        }
    }

    /**
     * @dev Release the tokens that have already vested.
     *
     * Emits a {TokenReleased} event.
     */
    function release(uint256 amount) external {
        uint256 maxReleasableAmount = releasable(msg.sender);

        require(
            amount <= maxReleasableAmount,
            "amount exceeds releasable amount!"
        );

        users[msg.sender].released += amount;

        IERC20(baseToken).safeTransfer(msg.sender, amount);

        emit TokenReleased(msg.sender, amount);
    }

    /**
     * @dev Getter for the end timestamp.
     */
    function end() public view returns (uint256) {
        return start + duration;
    }

    /**
     * @dev Amount of token already released
     */
    function released(address user) public view returns (uint256) {
        return users[user].released;
    }

    /**
     * @dev Getter for the releasable amount.
     */
    function releasable(address user) public view returns (uint256) {
        return _vestingSchedule(user, block.timestamp) - released(user);
    }

    /**
     * @dev implementation of the vesting formula. This returns the total amount can be released, as a function of time
     */
    function _vestingSchedule(
        address user,
        uint256 timestamp
    ) internal view returns (uint256) {
        uint256 totalAllocation = users[user].totalAllocation;

        if (timestamp < start) {
            return 0;
        } else if (timestamp >= end()) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - start)) / duration;
        }
    }
}
