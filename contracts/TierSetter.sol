// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// TODO: move it to interfaces folder
interface IMuonNodeStaking{
  function setMuonNodeTier(address stakerAddress, uint8 tier) external;
}

contract TierSetter is Ownable {

  using ECDSA for bytes32;

  // TODO: allow the owner to update signer
  address public signer = msg.sender;
  IMuonNodeStaking public nodeStaking;

  constructor(
    address _signer,
    IMuonNodeStaking staking
  ){
    signer = _signer;
    nodeStaking = staking;
  }

  function setTier(address stakerAddress, uint8 tier) public{
    //TODO: add and verify signature
    nodeStaking.setMuonNodeTier(stakerAddress, tier);
  }
}
