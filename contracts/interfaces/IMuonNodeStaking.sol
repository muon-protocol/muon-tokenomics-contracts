// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IMuonNodeStaking {
    function setMuonNodeTier(address stakerAddress, uint8 tier) external;
}
