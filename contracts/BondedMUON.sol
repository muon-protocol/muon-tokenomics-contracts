// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BondedToken.sol";
import "./interfaces/IEscrow.sol";

contract BondedMUON is BondedToken {
    bytes32 public constant REDEEM_ROLE = keccak256("REDEEM_ROLE");

    address public escrow;
    bool public isPublicRedeemEnabled;

    event Redeem(uint256 tokenId, address to, uint256 amount, address redeemer);

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

    function redeemBaseToken(uint256 _tokenId, uint256 _amount) external {
        require(_amount > 0, "Invalid amount");
        require(
            lockedOf[_tokenId][baseToken] >= _amount,
            "Insufficient balance"
        );

        if (!isPublicRedeemEnabled) {
            require(hasRole(REDEEM_ROLE, msg.sender), "Redeem is limited");
        } else {
            require(
                ownerOf(_tokenId) == msg.sender ||
                    hasRole(REDEEM_ROLE, msg.sender),
                "Permission denied"
            );
        }

        IEscrow(escrow).redeemTo(ownerOf(_tokenId), _amount);

        emit Redeem(_tokenId, ownerOf(_tokenId), _amount, msg.sender);
    }
}
