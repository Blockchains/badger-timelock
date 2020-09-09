//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/TokenTimelock.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Executor.sol";

/* 
  A token timelock that is capable of interacting with other smart contracts.
  This allows the beneficiary to participate in on-chain goverance processes, despite having locked tokens.

  Features safety functions to allow beneficiary to claim ETH & ERC20-compliant tokens sent to the timelock contract, accidentially or otherwise.
*/

contract SmartTimelock is TokenTimelock, Executor, ReentrancyGuard {
    constructor(
        IERC20 token,
        address beneficiary,
        uint256 releaseTime
    ) public TokenTimelock(token, beneficiary, releaseTime) {}

    event Call(address to, uint256 value, bytes data);
    event ClaimToken(IERC20 token, uint256 amount);
    event ClaimEther(uint256 amount);

    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary(), "smart-timelock/only-beneficiary");
        _;
    }

    /**
     * @notice Allows the timelock to call arbitrary contracts, as long as it does not reduce it's locked token balance
     * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
     *      created via `newVote(),` which requires initialization
     * @param to Contract address to call
     * @param value ETH value to send, if any
     * @param data Encoded data to send
     */
    function call(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyBeneficiary() nonReentrant() returns (bool success) {
        uint256 preAmount = token().balanceOf(address(this));

        success = execute(to, value, data, gasleft());

        uint256 postAmount = token().balanceOf(address(this));
        require(postAmount >= preAmount, "smart-timelock/locked-balance-check");

        emit Call(to, value, data);
    }

    /**
     * @notice Claim ERC20-compliant tokens other than locked token.
     * @param tokenToClaim Token to claim balance of.
     */
    function claimToken(IERC20 tokenToClaim)
        external
        onlyBeneficiary()
        nonReentrant()
    {
        require(
            address(tokenToClaim) != address(token()),
            "smart-timelock/no-locked-token-claim"
        );
        uint256 preAmount = token().balanceOf(address(this));

        uint256 claimableTokenAmount = tokenToClaim.balanceOf(address(this));
        require(
            claimableTokenAmount > 0,
            "smart-timelock/no-token-balance-to-claim"
        );

        tokenToClaim.transfer(beneficiary(), claimableTokenAmount);

        uint256 postAmount = token().balanceOf(address(this));
        require(postAmount >= preAmount, "smart-timelock/locked-balance-check");

        emit ClaimToken(tokenToClaim, claimableTokenAmount);
    }

    /**
     * @notice Claim Ether in contract.
     */
    function claimEther() external onlyBeneficiary() nonReentrant() {
        uint256 preAmount = token().balanceOf(address(this));

        uint256 etherToTransfer = address(this).balance;
        require(
            etherToTransfer > 0,
            "smart-timelock/no-ether-balance-to-claim"
        );

        payable(beneficiary()).transfer(etherToTransfer);

        uint256 postAmount = token().balanceOf(address(this));
        require(postAmount >= preAmount, "smart-timelock/locked-balance-check");

        emit ClaimEther(etherToTransfer);
    }
}
