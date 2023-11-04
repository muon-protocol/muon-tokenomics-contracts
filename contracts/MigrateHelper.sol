// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IToken.sol";

contract MigrateHelper is Ownable {
    using ECDSA for bytes32;

    IToken public muonToken;
    IToken public oldToken;

    address public signer;

    // wallet => claimed amount
    mapping(address => uint256) public claimed;

    event TokenClaimed(address indexed user, uint256 amount);

    constructor(address _muonTokenAddress, address _oldToken, address _signer) {
        muonToken = IToken(_muonTokenAddress);
        oldToken = IToken(_oldToken);
        signer = _signer;
    }

    function claim(uint256 amount, bytes memory signature) external {
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount));
        messageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = messageHash.recover(signature);

        require(recoveredSigner == signer, "Invalid signature");
        require(amount > claimed[msg.sender], "Invalid amount");

        uint256 pendingAmount = amount - claimed[msg.sender];
        oldToken.burnFrom(msg.sender, pendingAmount);

        claimed[msg.sender] = amount;
        IToken(muonToken).transfer(msg.sender, pendingAmount);

        emit TokenClaimed(msg.sender, pendingAmount);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function setMuonToken(address _token) external onlyOwner {
        muonToken = IToken(_token);
    }

    function ownerWithdraw(
        address tokenAddress,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(to != address(0));

        if (tokenAddress == address(0)) {
            payable(to).transfer(amount);
        } else {
            IToken(tokenAddress).transfer(to, amount);
        }
    }
}
