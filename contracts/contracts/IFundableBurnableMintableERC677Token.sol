pragma solidity 0.4.24;
import "./ERC677.sol";


contract IFundableBurnableMintableERC677Token is ERC677 {
    function mint(address, uint256) public returns (bool);
    function burn(uint256 _value) public;
    function claimTokens(address _token, address _to) public;
    function setFundingRules(uint256 _periodLength, uint256 _maxPeriodFunds, uint256 _threshold, uint256 _amount) public;
}
