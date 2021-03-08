pragma solidity 0.4.24;

import "./ForeignBridgeErcToErcV2.sol";
import "../ERC677Bridge.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../../ERC677Receiver.sol";

contract ForeignBridgeERC677ToNative is ForeignBridgeErcToErcV2, ERC677Receiver, ERC677Bridge {

    function erc20token() public view returns(ERC20Basic) {
        return ERC20Basic(erc677token());
    }

    function setErc20token(address _token) private {
        setErc677token(_token);
    }

    function tokenTransfer(address _recipient, uint256 _amount) internal returns(bool) {
        return erc677token().mint(_recipient, _amount);
    }

    function onTokenTransfer(address _from, uint256 _value, bytes /*_data*/) external returns(bool) {
        require(msg.sender == address(erc677token()));
        erc677token().burn(_value);
        fireEventOnTokenTransfer(_from, _value);
        return true;
    }
}
