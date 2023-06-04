// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BonToken.sol";

contract BonPION is BonToken {
    function initialize(address _Token, address _treasury) public initializer {
        BonToken._initialize(_Token, _treasury, "bonPION", "bonPION");
    }
}
