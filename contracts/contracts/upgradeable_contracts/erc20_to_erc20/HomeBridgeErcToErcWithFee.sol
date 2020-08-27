


pragma solidity 0.4.24;

import "../erc20_to_erc20/HomeBridgeErcToErc.sol";
import "../DepositWithdrawFeeManager.sol";

contract HomeBridgeErcToErcWithFee is EternalStorage, HomeBridgeErcToErc, DepositWithdrawFeeManager {
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
        erc677token().burn(value);
        fireEventOnTokenTransfer(_from, value);
        return true;
    }

    function onExecuteAffirmation(address _recipient, uint256 _value) internal returns(bool) {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));

        uint256 fee = depositFee(_value);
        if (_value <= fee) {
            erc677token().mint(feeReceiver(), _value);
            return true;
        }

        if (fee != 0) {
            erc677token().mint(feeReceiver(), fee);
        }

        uint256 value = _value.sub(fee);
        if (value != 0) {
            erc677token().mint(_recipient, value);
        }

        return true;
    }

    function callToken(bytes data) onlyOwner payable  external returns (bool) {
        require(erc677token().call.value(msg.value)(data));
        return true;
    }
}
