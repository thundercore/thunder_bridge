pragma solidity 0.4.24;

import "./ForeignBridgeErcToErc.sol";

contract ForeignBridgeErcToErcV2 is ForeignBridgeErcToErc {
    function onExecuteMessage(address _recipient, uint256 _amount) internal returns(bool){
        return tokenTransfer(_recipient, _amount);
    }

    function executeSignatures(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) external {
        Message.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract());
        address recipient;
        uint256 amount;
        bytes32 txHash;
        address contractAddress;
        (recipient, amount, txHash, contractAddress) = Message.parseMessage(message);
        require(contractAddress == address(this));
        require(!relayedMessages(txHash));
        setRelayedMessages(txHash, true);
        require(onExecuteMessage(recipient, amount));
        emit RelayedMessage(recipient, amount, txHash);
    }

    function setExecutionDailyLimit(uint256 _dailyLimit) public onlyOwner {
        require(false, "deprecated");
    }

    function setFeePercent(uint256 _feePercent) public onlyOwner {
        require(false, "deprecated");
    }
}
