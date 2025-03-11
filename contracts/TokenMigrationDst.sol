// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./utils/MuonClientBase.sol";
import "./utils/SchnorrSECP256K1VerifierV2.sol";
import "./interfaces/IEscrow.sol";

/**
 * @title TokenMigrationDst
 * @notice This contract will be deployed on DST chain to mint tokens to users
 */
contract TokenMigrationDst is Ownable {
    using SafeERC20 for IERC20;

    address public escrow;
    uint256 public multiplier; // multiplier * 1e18

    uint256 public muonAppId;
    MuonClientBase.PublicKey public muonPublicKey;
    SchnorrSECP256K1VerifierV2 public verifier;

    /// @dev save claimed migrations to prevent double spending
    mapping (uint256 => bool) claimedMigrations;

    event Claimed(
        address user,
        uint256 migratedAmount,
        uint256 claimedAmount,
        uint256 id
    );

    constructor(
        address _escrow,
        uint256 _multiplier,
        uint256 _muonAppId,
        MuonClientBase.PublicKey memory _muonPublicKey,
        address _verifierAddress
    ) {
        escrow = _escrow;
        multiplier = _multiplier;

        muonAppId = _muonAppId;
        muonPublicKey = _muonPublicKey;
        verifier = SchnorrSECP256K1VerifierV2(_verifierAddress);
    }

    function setEscrow(
        address _escrow
    ) external onlyOwner {
        escrow = _escrow;
    }

    function setMultiplier(
        uint256 _multiplier
    ) external onlyOwner {
        multiplier = _multiplier;
    }

    function setMuonAppId(uint256 _muonAppId) external onlyOwner {
        muonAppId = _muonAppId;
    }

    function setMuonPublicKey(
        MuonClientBase.PublicKey memory _muonPublicKey
    ) external onlyOwner {
        verifier.validatePubKey(_muonPublicKey.x);

        muonPublicKey = _muonPublicKey;
    }

    function setVerifier(
        address _verifierAddress
    ) external onlyOwner {
        verifier = SchnorrSECP256K1VerifierV2(_verifierAddress);
    }

    function claimMigration(
        uint256 _migrationId,
        uint256 _amount,
        bytes calldata reqId,
        MuonClientBase.SchnorrSign calldata signature
    ) external {
        require(_amount > 0, "Invalid amount!");
        require(!claimedMigrations[_migrationId], "Already claimed");

        bytes32 hash = keccak256(
            abi.encodePacked(
                muonAppId,
                reqId,
                msg.sender,
                _migrationId,
                _amount
            )
        );

        bool verified = verifier.verifySignature(
            muonPublicKey.x,
            muonPublicKey.parity,
            signature.signature,
            uint256(hash),
            signature.nonce
        );
        require(verified, "Invalid signature.");

        claimedMigrations[_migrationId] = true;


        uint256 convertAmount = (_amount * multiplier) / 1e18;
        IEscrow(escrow).redeemTo(
            msg.sender, 
            convertAmount
        );

        emit Claimed(msg.sender, _amount, convertAmount, _migrationId);
    }
}
