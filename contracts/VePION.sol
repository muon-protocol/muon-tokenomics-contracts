// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./interfaces/IPION.sol";

contract VePION is
    Initializable,
    ERC721Upgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ERC721BurnableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    CountersUpgradeable.Counter private _tokenIdCounter;

    address public PION;

    address[] public tokensWhitelist;
    mapping(address => bool) public isTokenWhitelisted;

    address[] public transferWhitelist;
    mapping(address => bool) public isTransferWhitelisted;

    // NFT id => token address => locked amount
    mapping(uint256 => mapping(address => uint256)) public lockedOf;

    // token address => total locked amount
    mapping(address => uint256) public totalLocked;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------------------------------------------------------------------------
    // Restricted Functions
    // ------------------------------------------------------------------------

    function initialize(address _PION) public initializer {
        __ERC721_init("vePION", "vePION");
        __Pausable_init();
        __Ownable_init();
        __ERC721Burnable_init();

        require(_PION != address(0), "Zero Address");

        PION = _PION;
        tokensWhitelist.push(PION);
        isTokenWhitelisted[PION] = true;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    /// @notice whitelists tokens
    /// @dev only whitelisted tokens can be locked
    /// @param tokens list of tokens to be whitelisted
    function whitelistTokens(address[] memory tokens) external onlyOwner {
        for (uint256 i; i < tokens.length; ++i) {
            tokensWhitelist.push(tokens[i]);
            isTokenWhitelisted[tokens[i]] = true;
        }
    }

    /// @notice whitelists for transfer
    /// @dev only whitelisted addresses can send/receive NFT
    /// @param addresses list of addresses to be whitelisted
    function whitelistTransferFor(
        address[] memory addresses
    ) external onlyOwner {
        for (uint256 i; i < addresses.length; ++i) {
            transferWhitelist.push(addresses[i]);
            isTransferWhitelisted[addresses[i]] = true;
        }
    }

    // ------------------------------------------------------------------------
    // Internal Functions
    // ------------------------------------------------------------------------

    /// @notice transfer is limited to staking contract
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        // check it's not a mint transaction
        if (from != address(0)) {
            require(
                isTransferWhitelisted[from] || isTransferWhitelisted[to],
                "Transfer Limited"
            );
        }

        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ------------------------------------------------------------------------
    // Public/External Functions
    // ------------------------------------------------------------------------

    /// @notice mints a new NFT for requested address
    /// @param to receiver of the NFT
    /// @return Minted tokenId
    function mint(address to) public whenNotPaused returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        return tokenId;
    }

    /// @notice locks tokens for give tokenId
    /// @dev tokens should be whitelisted and require approval for each token. tokenId tier will be updated at the end
    /// @param tokenId tokenId to deposit tokens for
    /// @param tokens list of tokens to deposit for tokenId
    /// @param amounts list of amounts of each token to deposit
    function lock(
        uint256 tokenId,
        address[] memory tokens,
        uint256[] memory amounts
    ) public whenNotPaused {
        uint256 len = tokens.length;
        require(len == amounts.length, "Length Mismatch");

        uint256 receivedAmount;
        for (uint256 i; i < len; ++i) {
            require(amounts[i] > 0, "Cannot Lock Zero Amount");

            if (tokens[i] == PION) {
                IPION(PION).burnFrom(msg.sender, amounts[i]);
                receivedAmount = amounts[i];
            } else {
                receivedAmount = IERC20Upgradeable(tokens[i]).balanceOf(
                    address(this)
                );
                IERC20Upgradeable(tokens[i]).safeTransferFrom(
                    msg.sender,
                    address(this),
                    amounts[i]
                );
                receivedAmount =
                    IERC20Upgradeable(tokens[i]).balanceOf(address(this)) -
                    receivedAmount;
            }

            lockedOf[tokenId][tokens[i]] += receivedAmount;
        }
    }

    /// @notice mints a new NFT for requested address and locks tokens for that NFT
    /// @param tokens list of tokens to deposit for tokenId
    /// @param amounts list of amounts of each token to deposit
    /// @param to receiver of the NFT
    /// @return tokenId minted
    function mintAndLock(
        address[] memory tokens,
        uint256[] memory amounts,
        address to
    ) external whenNotPaused returns (uint256 tokenId) {
        tokenId = mint(to);
        lock(tokenId, tokens, amounts);
    }

    /// @notice merges two tokenId. Burns tokenIdA and add it's underlying assets to tokenIdB
    /// @dev msg.sender should be owner of both tokenIdA and tokenIdB. tokenIdA and tokenIdB tier will be updated at the end
    /// @param tokenIdA first tokenId to merge. Will be burnedd
    /// @param tokenIdB second tokenId to merge. It's underlying assets will increase
    function merge(uint256 tokenIdA, uint256 tokenIdB) external whenNotPaused {
        require(
            ownerOf(tokenIdA) == msg.sender && ownerOf(tokenIdB) == msg.sender,
            "Not Owned"
        );

        for (uint256 i; i < tokensWhitelist.length; ++i) {
            lockedOf[tokenIdB][tokensWhitelist[i]] += lockedOf[tokenIdA][
                tokensWhitelist[i]
            ];
            lockedOf[tokenIdA][tokensWhitelist[i]] = 0;
        }

        burn(tokenIdA);
    }

    /// @notice splits NFT into two NFTs
    /// @dev msg.sender should be owner of both tokenId
    /// @param tokenId id of the NFT to split
    /// @param tokens list of tokens to move to new NFT
    /// @param amounts list of amounts to move to new NFT
    function split(
        uint256 tokenId,
        address[] memory tokens,
        uint256[] memory amounts
    ) external whenNotPaused returns (uint256 newTokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not Owned");

        uint256 len = tokens.length;
        require(len == amounts.length, "Length Mismatch");

        newTokenId = mint(msg.sender);

        for (uint256 i; i < len; ++i) {
            lockedOf[tokenId][tokens[i]] -= amounts[i];
            lockedOf[newTokenId][tokens[i]] += amounts[i];
        }
    }

    // ------------------------------------------------------------------------
    // View Functions
    // ------------------------------------------------------------------------

    /// @notice returns locked amount of requested tokens for given tokenId
    function getLockedOf(
        uint256 tokenId,
        address[] memory tokens
    ) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            amounts[i] = lockedOf[tokenId][tokens[i]];
        }
    }
}
