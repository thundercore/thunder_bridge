
pragma solidity 0.4.24;

import "./HomeBridgeErcToErcWithFee.sol";
import "../../IMinterBurner.sol";

contract HomeBridgeErcToErcWithFeeV2 is HomeBridgeErcToErcWithFee {
    function setMinterBurner(IMinterBurner _minterBurner) external onlyOwner {
        addressStorage[keccak256(abi.encodePacked("minterBurner"))] = _minterBurner;
    }

    function minterBurner() public returns (IMinterBurner) {
        return IMinterBurner(addressStorage[keccak256(abi.encodePacked("minterBurner"))]);
    }

    function onTokenTransfer(address _from, uint256 _value, bytes _data) external returns(bool) {
        require(msg.sender == address(erc677token()), "Unkown token");
        require(withinLimit(_value), "Transfer limit exceeded.");
        require(_value > withdrawFixedFee(), "Value is less than fee");
        uint256 fee = withdrawFee(_value);
        if (fee != 0) {
            require(erc677token().transfer(feeReceiver(), fee), "failed to transfer fee");
        }
        uint256 value = _value.sub(fee);

        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(value));
        minterBurner().burn(address(this), value);
        fireEventOnTokenTransfer(_from, value);
        return true;
    }

    function onExecuteAffirmation(address _recipient, uint256 _value) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));

        uint256 fee = depositFee(_value);
        if (_value <= fee) {
            minterBurner().mint(feeReceiver(), _value);
            return true;
        }

        if (fee != 0) {
            minterBurner().mint(feeReceiver(), fee);
        }

        uint256 value = _value.sub(fee);
        if (value != 0) {
            minterBurner().mint(_recipient, value);
        }

        return true;
    }

    function callToken(bytes data) external payable onlyOwner returns (bool) {
        revert("Deprecated");
        return false;
    }
}
