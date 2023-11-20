// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract BulkTransfer is Ownable {
    using SafeERC20 for IERC20;

    address public muonToken;

    constructor(
        address muonTokenAddress
    ){
        muonToken = muonTokenAddress;
    }

    function bulkTransfer(
        address[] calldata addresses,
        uint256[] calldata amounts
    ) public onlyOwner {
        require(addresses.length == amounts.length, "len mismatch");
        for(uint256 i=0; i<addresses.length; i++){
            IERC20(muonToken).safeTransfer(addresses[i], amounts[i]);
        }
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
            IERC20(_tokenAddr).transfer(_to, amount);
        }
    }
}
