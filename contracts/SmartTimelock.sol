//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/TokenTimelock.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Executor.sol";
import "./IVoting.sol";

/* 
  A token timelock that is capable of interacting with other smart contracts.
  This allows the beneficiary to participate in on-chain goverance processes, despite having locked tokens.

  Features a safety function to allow beneficiary to claim ETH stored in the timelock contract, accidentially or otherwise.
  Tokens or other assets accidentally stored in the contract can be claimed via the standard execute function.

  Because this implementation is intended to allow voting on Aragon DAOs, the ability to create proposals and vote are implemented for convenience.
*/

contract SmartTimelock is TokenTimelock, Executor, ReentrancyGuard {
    constructor (IERC20 token, address beneficiary, uint256 releaseTime) TokenTimelock(token, beneficiary, releaseTime) public {}

    /**
    * @notice Allows the timelock to call arbitrary contracts, as long as it does not reduce it's locked token balance
    * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
    *      created via `newVote(),` which requires initialization
    * @param to Contract address to call
    * @param value ETH value to send, if any
    * @param data Encoded data to send
    * @param txGas Maximum amount of gas to forward
    */
    function call(address to, uint256 value, bytes calldata data, uint256 txGas) external nonReentrant() returns (bool success) {        
        _preActionConditions();
        uint256 preAmount = token().balanceOf(address(this));

        success = execute(to, value, data, txGas);

        uint256 postAmount = token().balanceOf(address(this));
        _postActionConditions(preAmount, postAmount);

    }

    /**
    * @notice Create a new vote about "`_metadata`"
    * @param _votingApp Address of Aragon voting app to call
    * @param _executionScript EVM script to be executed on approval
    * @param _metadata Vote metadata
    * @param _castVote Whether to also cast newly created vote
    * @param _executesIfDecided Whether to also immediately execute newly created vote if decided
    */
    function newVote(IVoting _votingApp, bytes calldata _executionScript, string calldata _metadata, bool _castVote, bool _executesIfDecided)
        external nonReentrant()
    {
        _preActionConditions();
        uint256 preAmount = token().balanceOf(address(this));

        _votingApp.newVote(_executionScript, _metadata, _castVote, _executesIfDecided);

        uint256 postAmount = token().balanceOf(address(this));
        _postActionConditions(preAmount, postAmount);
    }

    /**
    * @notice Vote `_supports ? 'yes' : 'no'` in vote #`_voteId`
    * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
    *      created via `newVote(),` which requires initialization
    * @param _votingApp Address of Aragon voting app to call
    * @param _voteId Id for vote
    * @param _supports Whether voter supports the vote
    * @param _executesIfDecided Whether the vote should execute its action if it becomes decided
    */
    function vote(IVoting _votingApp, uint256 _voteId, bool _supports, bool _executesIfDecided) external nonReentrant() {
        _preActionConditions();
        uint256 preAmount = token().balanceOf(address(this));

        _votingApp.vote(_voteId, _supports, _executesIfDecided);

        uint256 postAmount = token().balanceOf(address(this));
        _postActionConditions(preAmount, postAmount);
    }

    function _preActionConditions() internal view {
        require(msg.sender == beneficiary(), "Only beneficiary can execute smart contract calls");
    }

    function _postActionConditions(uint256 preAmount, uint256 postAmount) internal pure {
        require(postAmount >= preAmount, "Timelock token balance decreased during operation");
    }
}
