// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IEscrow.sol";

contract Escrow is AccessControl, IEscrow {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REDEEMER_ROLE = keccak256("REDEEMER_ROLE");

    address public token;

    event Redeem(address recipient, uint256 amount);

    constructor(
        address _token
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        token = _token;
    }

    function redeemTo(
        address _recipient,
        uint256 _amount
    ) external onlyRole(REDEEMER_ROLE) {
        require(_amount > 0, "Invalid amount!");

        IToken(token).mint(_recipient, _amount);

        emit Redeem(_recipient, _amount);
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
            IToken(_tokenAddr).transfer(_to, amount);
        }
    }
}
