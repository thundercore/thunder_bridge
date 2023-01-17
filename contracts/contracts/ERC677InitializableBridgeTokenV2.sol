pragma solidity 0.4.24;

import "./ERC677InitializableBridgeToken.sol";

contract ERC677InitializableBridgeTokenV2 is ERC677InitializableBridgeToken {
    function burn(address _who, uint256 _amount) public onlyOwner {
        _burn(_who, _amount);
    }
}
