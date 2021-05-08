pragma solidity 0.4.24;

import "./ERC677InitializableToken.sol";

contract ERC677InitializableTokenV2 is ERC677InitializableToken {
    mapping(address => bool) allowTransferCallback;

    function transfer(address to, uint256 value) public returns (bool)
    {
        require(superTransfer(to, value), "failed superTransfer");
        fundReceiver(to);

        if (isCallable(to)) {
            if (to == bridgeContract || allowTransferCallback[to]) {
                if (!triggerTransferCallback(to, value, new bytes(0))) {
                    revert("Invoke transfer callback failed");
                }
            }
        }
        return true;
    }

    function enableTransferCallback(address addr) public onlyOwner {
        allowTransferCallback[addr] = true;
    }

    function disableTransferCallback(address addr) public onlyOwner {
        delete allowTransferCallback[addr];
    }

    function triggerTransferCallback(address addr, uint value, bytes data) internal returns (bool) {
        return addr.call(
            abi.encodeWithSignature(
                "onTokenTransfer(address,uint256,bytes)",
                msg.sender,
                value,
                data
            )
        );
    }

    function isCallable(address addr) internal view returns (bool) {
        uint length;
        assembly { length := extcodesize(addr) }
        return length > 0;
    }
}
