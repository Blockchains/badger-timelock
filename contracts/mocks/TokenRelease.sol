pragma solidity 0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenRelease {
    function giveTokensTo(IERC20 token, address recipient, uint256 amount) public {
        token.transfer(recipient, amount);
    }
}
