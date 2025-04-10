// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IBondedToken.sol";
import "./interfaces/IMuonNodeStaking.sol";

contract MuonDelegatorRewards is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IBondedToken public bondedToken;
    address public muonToken;
    address public delegationNodeStaker;
    uint256 public exitPendingPeriod;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public startDates;
    mapping(address => bool) public restake;
    mapping(address => uint256) public userIndexes;
    mapping(address => uint256) public pendingRewards;

    // staker address => amount
    mapping(address => uint256) public pendingUnstakes;

    // staker address => request time
    mapping(address => uint256) public unstakeReqTimes;

    // stakerAddress => bool
    mapping(address => bool) public lockedStakes;

    uint256 public lastDisTime;

    address[] public allUsers;
    IMuonNodeStaking public nodeStaking;
    uint256 public bonTokenId;

    event DelegatedNFT(address indexed user, uint256 nftId);
    event DelegatedToken(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 balance, uint256 amount);
    event Rewarded(address indexed user, uint256 balance, uint256 amount);
    event Unstake(address indexed user, uint256 balance, uint256 amount);
    event ClaimUnstake(address indexed user, uint256 amount);

    function initialize(
        address _muonTokenAddress,
        address _bondedTokenAddress,
        uint256 _lastDisTime,
        address _nodeStaker,
        address _nodeStaking
    ) public initializer {
        __MuonDelegatorRewards_init(
            _muonTokenAddress,
            _bondedTokenAddress,
            _lastDisTime,
            _nodeStaker,
            _nodeStaking
        );
    }

    function __MuonDelegatorRewards_init(
        address _muonTokenAddress,
        address _bondedTokenAddress,
        uint256 _lastDisTime,
        address _nodeStaker,
        address _nodeStaking
    ) internal onlyInitializing {
        __Ownable_init();
        __MuonDelegatorRewards_init_unchained(
            _muonTokenAddress,
            _bondedTokenAddress,
            _lastDisTime,
            _nodeStaker,
            _nodeStaking
        );
    }

    function __MuonDelegatorRewards_init_unchained(
        address _muonTokenAddress,
        address _bondedTokenAddress,
        uint256 _lastDisTime,
        address _nodeStaker,
        address _nodeStaking
    ) internal onlyInitializing {
        muonToken = _muonTokenAddress;
        bondedToken = IBondedToken(_bondedTokenAddress);
        lastDisTime = _lastDisTime;
        delegationNodeStaker = _nodeStaker;
        nodeStaking = IMuonNodeStaking(_nodeStaking);
    }

    function distribute(uint256 amount, uint256 time) external onlyOwner {
        uint256[] memory amounts = calcAmounts(amount, time);
        for (uint256 i = 0; i < allUsers.length; i++) {
            if(pendingRewards[allUsers[i]] != 0) {
                pendingRewards[allUsers[i]] = 0;
            }
            if (amounts[i] > 0) {
                if (!restake[allUsers[i]]) {
                    IERC20Upgradeable(muonToken).transfer(
                        allUsers[i],
                        amounts[i]
                    );
                    emit Rewarded(
                        allUsers[i],
                        balances[allUsers[i]],
                        amounts[i]
                    );
                } else {
                    // TODO: consider boosting
                    emit Rewarded(
                        allUsers[i],
                        balances[allUsers[i]],
                        amounts[i]
                    );
                    balances[allUsers[i]] += amounts[i];
                }
            }
        }
        lastDisTime = time;
    }

    function setLastDisTime(uint256 time) external onlyOwner {
        lastDisTime = time;
    }

    function bulkImport(
        address[] memory addrs,
        uint256[] memory _balances,
        uint256[] memory _startDates,
        bool[] memory _restakes
    ) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            address addr = addrs[i];
            balances[addr] = _balances[i];
            startDates[addr] = _startDates[i];
            restake[addr] = _restakes[i];
            allUsers.push(addr);
            userIndexes[addr] = allUsers.length;
        }
    }

    function removeUser(uint256 index) external onlyOwner {
        _removeUser(index);
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) external onlyOwner {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            IERC20Upgradeable(_tokenAddr).transfer(_to, amount);
        }
    }

    function delegateNFT(
        uint256 _nftID,
        address _user,
        bool _restake
    ) external {
        require(bondedToken.ownerOf(_nftID) == msg.sender, "Invalid nftId");
        bondedToken.safeTransferFrom(msg.sender, address(this), _nftID);
        require(bondedToken.ownerOf(_nftID) == address(this), "Transfer failed");
        uint256 amount = nodeStaking.valueOfBondedToken(_nftID);
        bondedToken.merge(_nftID, bonTokenId);

        if (userIndexes[_user] == 0) {
            startDates[_user] = block.timestamp;
            allUsers.push(_user);
            userIndexes[_user] = allUsers.length;
            restake[_user] = _restake;
        } else {
            startDates[_user] = calcNewStartDate(_user, amount);
        }
        balances[_user] += amount;

        emit DelegatedNFT(_user, _nftID);
        emit Staked(_user, balances[_user], amount);
    }

    function delegateToken(
        uint256 _amount,
        address _user,
        bool _restake
    ) external {
        uint256 balance = IERC20Upgradeable(muonToken).balanceOf(
            address(this)
        );
        IERC20Upgradeable(muonToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        uint256 receivedAmount = IERC20Upgradeable(muonToken).balanceOf(
            address(this)
        ) - balance;
        require(_amount == receivedAmount, "Invalid received amount");

        address[] memory tokens = new address[](1);
        tokens[0] = muonToken;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        IERC20Upgradeable(muonToken).approve(address(bondedToken), _amount);
        uint256 tokenId = bondedToken.mintAndLock(tokens, amounts, address(this));
        uint256 nftValue = nodeStaking.valueOfBondedToken(tokenId);
        bondedToken.merge(tokenId, bonTokenId);


        if (userIndexes[_user] == 0) {
            startDates[_user] = block.timestamp;
            allUsers.push(_user);
            userIndexes[_user] = allUsers.length;
            restake[_user] = _restake;
        } else {
            startDates[_user] = calcNewStartDate(_user, nftValue);
        }
        balances[_user] += nftValue;

        emit DelegatedToken(_user, nftValue);
        emit Staked(_user, balances[_user], nftValue);
    }

    function setRestake(bool _restake) external {
        restake[msg.sender] = _restake;
    }

    function setNodeStaking(address _staking) external onlyOwner {
        nodeStaking = IMuonNodeStaking(_staking);
    }

    function setBonToken(uint256 _tokenId) external onlyOwner {
        bonTokenId = _tokenId;
    }

    function setExitPendingPeriod(uint256 _pendingPeriod) external onlyOwner {
        exitPendingPeriod = _pendingPeriod;
    }

    function withdrawBonToken(address _to) external onlyOwner {
        bondedToken.safeTransferFrom(address(this), _to, bonTokenId);
        bonTokenId = bondedToken.mint(address(this));
    }

    function fixUserIndex(address user, uint256 index) external onlyOwner {
        userIndexes[user] = index;
    }

    /**
     * @dev Locks or unlocks the specified delegator's stake.
     */
    function setStakeLockStatus(
        address user,
        bool lockStatus
    ) external onlyOwner {
        require(userIndexes[user] != 0, "User not found");
        lockedStakes[user] = lockStatus;
    }

    /**
     * 
     * @param _amount the amount to unstake
     */
    function unstake(uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient balance");

        if(_amount == balances[msg.sender]) {
            _removeUser(userIndexes[msg.sender]);
        } else {
            // Calculate user's pendingReward before the balance change
            uint256 userSecs = block.timestamp - lastDisTime;
            if (startDates[msg.sender] > lastDisTime) {
                userSecs = block.timestamp - startDates[msg.sender];
            }
            pendingRewards[msg.sender] += balances[msg.sender] * userSecs;

            // Change the balance and start date
            balances[msg.sender] -= _amount;
            startDates[msg.sender] = block.timestamp;
        }

        uint256 balance = IERC20Upgradeable(muonToken).balanceOf(
            address(this)
        );
        nodeStaking.unstake(_amount);
        uint256 receivedAmount = IERC20Upgradeable(muonToken).balanceOf(
            address(this)
        ) - balance;
        require(_amount == receivedAmount, "Invalid received amount");

        pendingUnstakes[msg.sender] += _amount;
        unstakeReqTimes[msg.sender] = block.timestamp;

        if (exitPendingPeriod == 0) {
            claimUnstake();
        }

        emit Unstake(msg.sender, balances[msg.sender], _amount);
    }

    /**
     * @notice claim pending unstake
     */
    function claimUnstake() public {
        require(!lockedStakes[msg.sender], "Stake is locked");
        require(pendingUnstakes[msg.sender] > 0, "No pending unstake");
        require(
            unstakeReqTimes[msg.sender] + exitPendingPeriod <= block.timestamp,
            "The unstake time has not been reached yet."
        );

        uint256 amount = pendingUnstakes[msg.sender];

        delete pendingUnstakes[msg.sender];
        delete unstakeReqTimes[msg.sender];

        IERC20Upgradeable(muonToken).safeTransfer(
            msg.sender,
            amount
        );

        emit ClaimUnstake(msg.sender, amount);
    }

    function calcAmounts(
        uint256 amount,
        uint256 time
    ) public view returns (uint256[] memory out) {
        uint256 totalSecs = 0;
        uint256 periodSecs = time - lastDisTime;

        out = new uint256[](allUsers.length);
        for (uint256 i = 0; i < allUsers.length; i++) {
            uint256 userSecs = periodSecs;
            if (startDates[allUsers[i]] > lastDisTime) {
                userSecs = time - startDates[allUsers[i]];
            }
            out[i] = balances[allUsers[i]] * userSecs;
            if(pendingRewards[allUsers[i]] > 0) {
                out[i] += pendingRewards[allUsers[i]];
            }
            totalSecs += out[i];
        }

        for (uint256 i = 0; i < allUsers.length; i++) {
            out[i] = (out[i] * amount) / totalSecs;
        }
    }

    /**
     * 
     * @param _user staker/unstaker user
     * @param _stakeAmount the amount of stake
     * @dev It calculates the weighted average of timestamps
     * newStartDate = (prev-balance * prev-startdate) + (added balance * now) / new balance
     * Ex:
     * prevBalance = 12k, prevStartDate = t1, added Balance = 2k, now = t2
     * newStartDate = ( (12k * t1) + (2k * t2) ) / 14k
     */
    function calcNewStartDate(
        address _user,
        uint256 _stakeAmount
    ) public view returns (uint256 newStartDate) {
        uint256 b1t1 = balances[_user] * startDates[_user];
        uint256 b2t2 = block.timestamp * _stakeAmount;
        newStartDate = (b1t1 + b2t2) / (balances[_user] + _stakeAmount);
    }

    function getUsers(
        uint256 fromIndex,
        uint256 toIndex
    )
        external
        view
        returns (
            address[] memory _addrs,
            uint256[] memory _balances,
            uint256[] memory _startDates,
            bool[] memory _restakes
        )
    {
        _addrs = new address[](toIndex - fromIndex + 1);
        _balances = new uint256[](toIndex - fromIndex + 1);
        _startDates = new uint256[](toIndex - fromIndex + 1);
        _restakes = new bool[](toIndex - fromIndex + 1);

        uint256 j = 0;
        for (uint256 i = fromIndex - 1; i < toIndex; i++) {
            address user = allUsers[i];
            _addrs[j] = user;
            _balances[j] = balances[user];
            _startDates[j] = startDates[user];
            _restakes[j] = restake[user];
            j++;
        }
    }

    function getUsersLength() external view returns(uint256) {
        return allUsers.length;
    }

    function transferable(
        uint256 amount,
        uint256 time
    ) external view returns (uint256) {
        uint256[] memory amounts = calcAmounts(amount, time);
        uint256 out = 0;
        for (uint256 i = 0; i < allUsers.length; i++) {
            if (amounts[i] > 0) {
                if (!restake[allUsers[i]]) {
                    out += amounts[i];
                }
            }
        }
        return out;
    }

    /**
     * @dev ERC721 token receiver function.
     *
     * @return bytes4 `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _removeUser(uint256 index) internal {
        address _user = allUsers[index - 1];
        address lastUser = allUsers[allUsers.length - 1];
        allUsers[index - 1] = lastUser;
        allUsers.pop();
        balances[_user] = 0;
        startDates[_user] = 0;
        restake[_user] = false;
        userIndexes[lastUser] = index;
        userIndexes[_user] = 0;
        pendingRewards[_user] = 0;
    }
}
