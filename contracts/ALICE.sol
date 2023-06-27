// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Token.sol";

contract ALICE is Token {
    function initialize() public initializer {
        Token._initialize("Alice Network", "ALICE");
    }
}
