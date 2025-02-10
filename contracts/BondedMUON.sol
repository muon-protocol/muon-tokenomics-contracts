// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BondedToken.sol";

contract BondedMUON is BondedToken {
    address public escrow;

    function initialize(
        address _token,
        address _treasury,
        address _escrow
    ) external initializer {
        BondedToken._initialize(
            _token,
            _treasury,
            "Bonded MUON NFT",
            "bonMUON"
        );
        escrow = _escrow;
    }

}
