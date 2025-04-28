// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MuonVestingManager is AccessControl {
    using SafeERC20 for IERC20;

    struct User {
        uint256 vestedAmount;
        uint256 released;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELEASE_FOR_ROLE = keccak256("RELEASE_FOR_ROLE");

    address public baseToken;

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
    ) {
        _setupRole(ADMIN_ROLE, msg.sender);

        baseToken = _baseToken;
        start = _startTimestamp;
        duration = _durationSeconds;
    }

    function bulkImport(
        address[] memory _addrs,
        uint256[] memory _balances
    ) external onlyRole(ADMIN_ROLE) {
        require(_addrs.length == _balances.length, "Length mismatch");

        uint256 len = _addrs.length;
        for (uint256 i = 0; i < len; i++) {
            address addr = _addrs[i];
            users[addr] = User(_balances[i], 0);
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
     * @dev Release the tokens on a user's behalf.
     *
     * Emits a {TokenReleased} event.
     */
    function releaseFor(
        address user,
        uint256 amount
    ) external onlyRole(RELEASE_FOR_ROLE) {
        uint256 maxReleasableAmount = releasable(user);

        require(
            amount <= maxReleasableAmount,
            "amount exceeds releasable amount!"
        );

        users[user].released += amount;

        IERC20(baseToken).safeTransfer(msg.sender, amount);

        emit TokenReleased(user, amount);
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) external onlyRole(ADMIN_ROLE) {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            IERC20(_tokenAddr).transfer(_to, amount);
        }
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
        uint256 vestedAmount = users[user].vestedAmount;

        if (timestamp < start) {
            return 0;
        } else if (timestamp >= end()) {
            return vestedAmount;
        } else {
            return (vestedAmount * (timestamp - start)) / duration;
        }
    }
}
