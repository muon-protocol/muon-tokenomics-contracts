// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BondedToken.sol";

contract BondedPION is BondedToken {
    function initialize(
        address _token,
        address _treasury,
        uint256 _tokenIdCounter,
        uint256 _totalLocked
    ) external initializer {
        BondedToken._initialize(
            _token,
            _treasury,
            "Bonded PION NFT",
            "bonPION"
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

            emit Locked(msg.sender, nftId, tokens, amounts);
        }
    }
}
