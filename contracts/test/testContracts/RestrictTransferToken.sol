pragma solidity ^0.4.17;

import "../../contracts/ERC677BridgeToken.sol";

contract RestrictTransferToken is ERC677BridgeToken {
  bool shouldRevert;

  constructor(
      string _name,
      string _symbol,
      uint8 _decimals,
      bool _shouldRevert
      )
  public ERC677BridgeToken(_name, _symbol, _decimals) {
    shouldRevert = _shouldRevert;
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    if (_to == address(this)) {
      if (shouldRevert) {
        revert("to == this");
      }
      return false;
    }
    return super.transfer(_to, _value);
  }
}