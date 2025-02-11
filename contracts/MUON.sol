// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Token.sol";

contract MUON is Token {
    function initialize() external initializer {
        Token._initialize("MUON Network", "MUON");
    }
}
