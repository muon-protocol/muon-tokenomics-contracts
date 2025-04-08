// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEscrow {
    function redeemTo(address _recipient, uint256 _amount) external;
}
