// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IBondedToken.sol";


contract BoosterV2 is Ownable {
    using SafeERC20 for IERC20;

    address public muonToken;

    IBondedToken public bondedToken;

    // multiplier * 1e18
    uint256 public boostValue;

    event Boosted(
        uint256 indexed nftId,
        address indexed addr,
        uint256 amount,
        uint256 boostedAmount
    );

    constructor(
        address muonTokenAddress,
        address bondedTokenAddress,
        uint256 _boostValue
    ){
        muonToken = muonTokenAddress;
        bondedToken = IBondedToken(bondedTokenAddress);
        boostValue = _boostValue;
    }

    function boost(
        uint256 nftId,
        uint256 amount
    ) public {
        require(amount > 0, "0 amount");

        IERC20(muonToken).safeTransferFrom(msg.sender, address(this), amount);

        address[] memory tokens = new address[](1);
        tokens[0] = muonToken;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = (amount * boostValue) / 1e18;

        IToken(muonToken).mint(address(this), amounts[0] - amount);
        IToken(muonToken).approve(address(bondedToken), amounts[0]);
        
        bondedToken.lock(nftId, tokens, amounts);
        
        emit Boosted(
            nftId,
            msg.sender,
            amount,
            boostValue
        );
    }

    function createAndBoost(
        uint256 muonAmount
    ) public returns(uint256){
        require(muonAmount > 0, "0 amount");
        uint256 nftId = bondedToken.mint(msg.sender);
        
        boost(nftId, muonAmount);
        return nftId;
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) public onlyOwner {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            IToken(_tokenAddr).transfer(_to, amount);
        }
    }

    /// @notice Sets the boostValue
    /// @param _value The new boost value
    function setBoostValue(uint256 _value) external onlyOwner {
        boostValue = _value;
    }
}