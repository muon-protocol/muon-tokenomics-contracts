// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IToken.sol";

/**
 * @title TokenMigration
 * @notice This contract will burn users' liquid tokens
 */
contract TokenMigration is Ownable, Pausable {
    /// @notice token to be migrated/burnt
    address public baseToken;

    /// @notice user => amount
    mapping(address => uint256) public migrations;

    event Migrated(address user, uint256 amount);

    constructor(address _baseToken) {
        baseToken = _baseToken;
    }

    function setToken(address _baseToken) external onlyOwner {
        baseToken = _baseToken;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function migrate(uint256 _amount) external whenNotPaused {
        require(_amount > 0, "Invalid amount!");

        IToken(baseToken).burnFrom(msg.sender, _amount);
        migrations[msg.sender] += _amount;

        emit Migrated(msg.sender, _amount);
    }
}
