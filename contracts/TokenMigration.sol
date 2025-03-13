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
    uint256 public lastUserId;

    /// @notice id => address
    mapping(uint256 => address) public users;
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

        if (migrations[msg.sender] == 0) {
            users[++lastUserId] = msg.sender;
        }
        migrations[msg.sender] += _amount;

        emit Migrated(msg.sender, _amount);
    }

    function getMigrations(
        uint256 _fromId,
        uint256 _toId
    )
        external
        view
        returns (address[] memory _users, uint256[] memory _balances)
    {
        _users = new address[](_toId - _fromId + 1);
        _balances = new uint256[](_toId - _fromId + 1);

        uint256 j = 0;
        for (uint256 i = _fromId; i <= _toId; i++) {
            address user = users[i];
            _users[j] = user;
            _balances[j] = migrations[user];
            j++;
        }
    }
}
