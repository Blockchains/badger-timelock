pragma solidity 0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

contract MockToken is ERC20PresetMinterPauser {
       constructor(string memory name, string memory symbol) public ERC20PresetMinterPauser(name, symbol){}
}
    

