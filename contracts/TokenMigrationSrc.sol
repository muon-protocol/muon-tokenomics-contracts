// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IToken.sol";

/**
 * @title TokenMigrationSrc
 * @notice This contract will be deployed on SRC chain to burn users' liquid tokens and let them mint on DST
 */
contract TokenMigrationSrc is Ownable {
    struct Migration {
        address user;
        uint256 amount;
    }

    /// @notice token to be migrated/burnt
    address public baseToken;

    uint256 public lastMigrationId;

    /// @notice id => Migration
    mapping(uint256 => Migration) public migrations;

    event Migrated(
        address user,
        uint256 amount,
        uint256 id
    );

    constructor(address _baseToken) {
        baseToken = _baseToken;
    }

    function setToken(
        address _baseToken
    ) external onlyOwner {
        baseToken = _baseToken;
    }

    function migrate(uint256 _amount) external {
        require(_amount > 0, "Invalid amount!");

        IToken(baseToken).burnFrom(msg.sender, _amount);

        migrations[++lastMigrationId] = Migration({
            user: msg.sender,
            amount: _amount
        });

        emit Migrated(msg.sender, _amount, lastMigrationId);
    }
}
