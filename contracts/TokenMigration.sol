// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IEscrow.sol";

contract TokenMigration is Ownable {
    using SafeERC20 for IERC20;

    address public baseToken;
    address public escrow;

    event Migrated(address to, uint256 amount);

    constructor(address _baseToken, address _escrow) {
        baseToken = _baseToken;
        escrow = _escrow;
    }

    function setToken(
        address _baseToken
    ) external onlyOwner {
        baseToken = _baseToken;
    }

    function setEscrow(
        address _escrow
    ) external onlyOwner {
        escrow = _escrow;
    }

    function migrate(uint256 _amount) external {
        require(_amount > 0, "Invalid amount!");

        IToken(baseToken).burnFrom(msg.sender, _amount);
        IEscrow(escrow).redeemTo(msg.sender, _amount);

        emit Migrated(msg.sender, _amount);
    }
}
