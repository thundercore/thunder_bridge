pragma solidity ^0.4.19;

import "../../contracts/ERC677Receiver.sol";


contract ERC677ReceiverTest is ERC677Receiver {
    address public from;
    uint public value;
    bytes public data;
    uint public someVar = 0;

    bool private failure = false;

    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns(bool) {
        require(!failure, "onTokenTransfer failure");

        from = _from;
        value = _value;
        data = _data;
        address(this).call(_data);
        return true;
    }

    function setCallbackFailure(bool _failure) public {
        failure = _failure;
    }

    function doSomething(uint _value) public {
        someVar = _value;
    }
}
