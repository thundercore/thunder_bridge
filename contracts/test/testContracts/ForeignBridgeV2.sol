pragma solidity ^0.4.19;


import "../../contracts/upgradeable_contracts/erc20_to_erc20/ForeignBridgeErcToErc.sol";


contract ForeignBridgeV2 is ForeignBridgeErcToErc {
    // used for testing
    event FallbackReceived(address from, uint256 amount);

    address public something;
    function doSomething(address _newTokenOwner) public onlyOwner {
        something = _newTokenOwner;
    }

    function () public payable {
      emit FallbackReceived(msg.sender, msg.value);
    }
}