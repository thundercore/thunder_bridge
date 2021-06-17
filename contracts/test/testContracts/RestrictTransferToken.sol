pragma solidity ^0.4.17;

import "../../contracts/ERC677BridgeToken.sol";

contract RestrictTransferToken is ERC677BridgeToken {
  constructor(
      string _name,
      string _symbol,
      uint8 _decimals)
  public ERC677BridgeToken(_name, _symbol, _decimals) {}

  function transfer(address _to, uint256 _value) public returns (bool) {
    require(_to != address(this));
    return super.transfer(_to, _value);
  }
}