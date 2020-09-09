pragma solidity 0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenGifter {
    function requestTransfer(IERC20 token, uint256 amount) public {
        token.transfer(msg.sender, amount);
    }
}
