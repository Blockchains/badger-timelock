# Smart TimeLock
An expansion of the OpenZeppelin token timelock that is capable of interacting with other smart contracts.
This is intended to allow the beneficiary to participate in on-chain goverance processes, despite having locked tokens.

It is based on the [OpenZeppelin Timelock](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/TokenTimelock.sol), incorporating a limited version of the [Gnosis Safe Executor](https://github.com/gnosis/safe-contracts/blob/development/contracts/base/Executor.sol) to allow flexible external calls. The ability to use delegateCall is removed for security reasons.

These external contract calls are gated with the following requirements:
* Only the beneficiary may call these functions.
* The Timelock's balance of the locked token MUST NOT decrease from before to after the call. This ensures that the tokens cannot be spent before the timelock period is complete.

There are safety functions for the beneficiary to withdraw the balance of tokens (other than the locked token) and ether sent to the contract, accidentially or otherwise.

Once the timelock period is complete, the locked tokens can be withdrawn via the standard method.
