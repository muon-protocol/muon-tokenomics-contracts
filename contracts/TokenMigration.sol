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
    uint256 public multiplier; // multiplier * 1e18

    event Migrated(
        address to,
        uint256 fromAmount,
        uint256 toAmount
    );

    constructor(address _baseToken, address _escrow, uint256 _multiplier) {
        baseToken = _baseToken;
        escrow = _escrow;
        multiplier = _multiplier;
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

    function setMultiplier(
        uint256 _multiplier
    ) external onlyOwner {
        multiplier = _multiplier;
    }

    function migrate(uint256 _amount) external {
        require(_amount > 0, "Invalid amount!");

        IToken(baseToken).burnFrom(msg.sender, _amount);
        uint256 convertAmount = (_amount * multiplier) / 1e18;
        IEscrow(escrow).redeemTo(
            msg.sender, 
            convertAmount
        );

        emit Migrated(msg.sender, _amount, convertAmount);
    }
}
