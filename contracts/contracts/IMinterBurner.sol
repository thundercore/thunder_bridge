pragma solidity 0.4.24;

contract IMinterBurner {
  function mint(address _to, uint256 _value) public returns (bool);
  function burn(address _who, uint256 _value) public;
}