// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IToken.sol";

contract PIONHelper is Ownable {
    using ECDSA for bytes32;

    IToken public muonToken;
    address public signer;

    event TokenClaimed(address indexed user, uint256 amount);

    constructor(address _muonTokenAddress, address _signer) {
        muonToken = IToken(_muonTokenAddress);
        signer = _signer;
    }

    function claimToken(uint256 amount, bytes memory signature) external {
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount));
        messageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = messageHash.recover(signature);

        require(recoveredSigner == signer, "Invalid signature");

        IToken(muonToken).transfer(msg.sender, amount);

        emit TokenClaimed(msg.sender, amount);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function withdraw(
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
