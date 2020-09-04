# Smart TimeLock
A token timelock that is capable of interacting with other smart contracts.
This is intended to allow the beneficiary to participate in on-chain goverance processes, despite having locked tokens.

It is based on the OpenZeppelin Timelock, incorporating a limited version of the Gnosis Safe Executor to allow flexible external calls.

Because this implementation is intended to allow voting on Aragon DAOs, there is also a vote() function implemented for convenience.

These external contract calls are gated with the following requirements:
* Only the beneficiary may call these functions.
* The Timelock's balance of the locked token MUST NOT decrease from before to after the call.
