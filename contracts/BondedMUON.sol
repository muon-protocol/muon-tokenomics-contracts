// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BondedToken.sol";

contract BondedMUON is BondedToken {
    function initialize(
        address _token,
        address _treasury,
        uint256 _tokenIdCounter,
        uint256 _totalLocked,
        address _escrow
    ) external initializer {
        BondedToken._initialize(
            _token,
            _treasury,
            "Bonded MUON NFT",
            "bonMUON",
            _escrow
        );
        tokenIdCounter = _tokenIdCounter;
        totalLocked[_token] = _totalLocked;
    }

    function migrate(
        uint256[] calldata _tokenId,
        address[] calldata _owner,
        uint256[] calldata _balance,
        uint256[] calldata _mintedAt
    ) external onlyOwner {
        uint256 length = _tokenId.length;
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = baseToken;

        for(uint256 i = 0; i < length; i++) {
            uint256 nftId = _tokenId[i];
            
            _safeMint(_owner[i], nftId);

            lockedOf[nftId][baseToken] = _balance[i];
            mintedAt[nftId] = _mintedAt[i];

            amounts[0] = _balance[i];

            tokenIdCounter++;
            totalLocked[baseToken] += _balance[i];

            emit Locked(msg.sender, nftId, tokens, amounts);
        }
    }

    function setTokenIdCounter(uint256 _tokenIdCounter) external onlyOwner {
        tokenIdCounter = _tokenIdCounter;
    }

    function setTotalLocked(address _token, uint256 _totalLocked) external onlyOwner {
        totalLocked[_token] = _totalLocked;
    }

    function setBalance(
        uint256 _tokenId,
        uint256 _amount
    ) external onlyOwner {
        totalLocked[baseToken] -= lockedOf[_tokenId][baseToken];
        lockedOf[_tokenId][baseToken] = _amount;
        totalLocked[baseToken] += _amount;
    }
}
