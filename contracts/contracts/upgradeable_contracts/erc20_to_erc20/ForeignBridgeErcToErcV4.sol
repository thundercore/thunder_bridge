pragma solidity 0.4.24;

import "./ForeignBridgeErcToErcV3.sol";

contract ForeignBridgeErcToErcV4 is ForeignBridgeErcToErcV3 {
    function claimTokens(address _token, address _to) public onlyIfOwnerOfProxy {
        BasicBridge.claimTokens(_token, _to);
    }
}