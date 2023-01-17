pragma solidity 0.4.24;

import "./ERC677MultiBridgeToken.sol";


contract ERC677MultiBridgeTokenV2 is ERC677MultiBridgeToken {
    constructor(
        string _name,
        string _symbol,
        uint8 _decimals)
    public ERC677MultiBridgeToken(_name, _symbol, _decimals) {}

    function burn(address _who, uint256 _amount) public onlyOwner {
        _burn(_who, _amount);
    }
}