//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.8;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/token/ERC20/TokenTimelock.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Executor.sol";
import "./IVoting.sol";

/* 
  A token timelock that is capable of interacting with other smart contracts.
  This allows the beneficiary to participate in on-chain goverance processes, despite having locked tokens.

  Features a safety function to allow beneficiary to claim ETH stored in the timelock contract, accidentially or otherwise.
  Tokens or other assets accidentally stored in the contract can be claimed via the standard execute function.

  Because this implementation is intended to allow voting on Aragon DAOs, the vote function is implemented independently for convenience.
*/
contract SmartTimelock is TokenTimelock, Executor {
      constructor (IERC20 token, address beneficiary, uint256 releaseTime) TokenTimelock(token, beneficiary, releaseTime) public {}

      // @ notice Allows the timelock to call arbitrary contracts, as long as it does not reduce it's locked token balance
      function call(address to, uint256 value, bytes memory data, uint256 txGas) public returns (bool success) {        
        require(msg.sender == beneficiary(), "Only beneficiary can execute smart contract calls");
        uint256 preAmount = token().balanceOf(address(this));

        success = execute(to, value, data, txGas);

        uint256 postAmount = token().balanceOf(address(this));
        require(preAmount >= postAmount, "Timelock token balance decreased during operation");
      }

      function vote(IVoting votingApp, uint256 _voteId, bool _supports, bool _executesIfDecided) external {
        require(msg.sender == beneficiary(), "Only beneficiary can execute smart contract calls");
        uint256 preAmount = token().balanceOf(address(this));

        votingApp.vote(_voteId, _supports, _executesIfDecided);

        uint256 postAmount = token().balanceOf(address(this));
        require(preAmount >= postAmount, "Timelock token balance decreased during operation");
      }
}
