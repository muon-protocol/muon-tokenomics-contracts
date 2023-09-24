// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IBondedToken.sol";

contract Booster is Initializable, AccessControlUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    IToken public muonToken;
    IERC20 public usdcToken;

    IBondedToken public bondedToken;

    address public treasury;

    IUniswapV2Router02 public uniswapV2Router;
    IUniswapV2Pair public uniswapV2Pair;

    // multiplier * 1e18
    uint256 public boostValue;

    function __Booster_init(
        address muonTokenAddress,
        address usdcAddress,
        address bondedTokenAddress,
        address _treasury,
        address _uniswapV2Router,
        address _uniswapV2Pair,
        uint256 _boostValue
    ) internal initializer {
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(DAO_ROLE, msg.sender);

        muonToken = IToken(muonTokenAddress);
        usdcToken = IERC20(usdcAddress);
        bondedToken = IBondedToken(bondedTokenAddress);

        uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
        uniswapV2Pair = IUniswapV2Pair(_uniswapV2Pair);

        treasury = _treasury;
        boostValue = _boostValue;
    }

    function initialize(
        address muonTokenAddress,
        address usdcAddress,
        address bondedTokenAddress,
        address _treasury,
        address _uniswapV2Router,
        address _uniswapV2Pair,
        uint256 _boostValue
    ) external initializer {
        __Booster_init(
            muonTokenAddress,
            usdcAddress,
            bondedTokenAddress,
            _treasury,
            _uniswapV2Router,
            _uniswapV2Pair,
            _boostValue
        );
        __AccessControl_init();
    }

    function __Booster_init_unchained() internal initializer {}

    function boost(uint256 nftId, uint256 amount) public {
        // TODO: check limits (Reza)

        // TODO: validate nftId

        require(
            usdcToken.transferFrom(msg.sender, address(this), amount),
            "transferFrom error"
        );

        (uint112 reserve0, uint112 reserve1, ) = uniswapV2Pair.getReserves();

        uint256 muonAmount;
        if (uniswapV2Pair.token0() == address(usdcToken)) {
            muonAmount = (amount * reserve1) / reserve0;
        } else {
            muonAmount = (amount * reserve0) / reserve1;
        }

        muonToken.mint(address(this), muonAmount);

        muonToken.approve(address(uniswapV2Router), muonAmount);
        usdcToken.approve(address(uniswapV2Router), amount);

        uniswapV2Router.addLiquidity(
            address(muonToken),
            address(usdcToken),
            muonAmount,
            amount,
            0,
            0,
            treasury,
            block.timestamp
        );

        address[] memory tokens = new address[](1);
        tokens[0] = address(muonToken);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = (muonAmount * boostValue) / 1e18;

        muonToken.mint(address(this), amounts[0]);
        muonToken.approve(address(bondedToken), amounts[0]);
        
        bondedToken.lock(nftId, tokens, amounts);
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) public onlyRole(ADMIN_ROLE) {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            IERC20(_tokenAddr).transfer(_to, amount);
        }
    }

    /// @notice Set the treasury address
    /// @param _treasury The new treasury address
    function setTreasury(address _treasury) external onlyRole(DAO_ROLE) {
        treasury = _treasury;
    }

    /// @notice Set the boostValue
    /// @param _value The new boost value
    function setBoostValue(uint256 _value) external onlyRole(ADMIN_ROLE) {
        boostValue = _value;
    }
}