// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMuonNodeStaking.sol";
import "./interfaces/IMuonNodeManager.sol";


contract NodeStakingHelper is Ownable {

    IMuonNodeStaking public nodeStaking;
    IMuonNodeManager public nodeManager;


    constructor(
        address muonNodeStaking,
        address muonNodeManager
    ){
        nodeStaking = IMuonNodeStaking(muonNodeStaking);
        nodeManager = IMuonNodeManager(muonNodeManager);
    }

    function updateNodeStakes(
        address[] calldata stakers
    ) external onlyOwner {
        for(uint256 i=0; i<stakers.length; i++){
            IMuonNodeManager.Node memory node = nodeManager.stakerAddressInfo(
                stakers[i]
            );
            if(node.tier > 0) {
                nodeStaking.setMuonNodeTier(stakers[i], node.tier - 1);
                nodeStaking.setMuonNodeTier(stakers[i], node.tier);
            }
        }
    }
}
