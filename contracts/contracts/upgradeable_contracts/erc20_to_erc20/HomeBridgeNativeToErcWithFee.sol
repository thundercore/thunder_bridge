pragma solidity 0.4.24;

import "../erc20_to_erc20/HomeBridgeErcToErcWithFee.sol";
import "../DepositWithdrawFeeManager.sol";

contract HomeBridgeNativeToErcWithFee is HomeBridgeErcToErcWithFee {
    string public constant name = "Thunder Token";
    string public constant symbol = "TT";
    uint8 public constant decimals = 18;

    event RecipientRedirected(address indexed from, address indexed to);

    function initialize(
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _erc677token,
        uint256 _foreignDailyLimit,
        uint256 _foreignMaxPerTx,
        address _owner,
        uint256 _feePercent,
        address _fallbackRecipient
    ) public returns (bool) {
        _setFallbackRecipient(_fallbackRecipient);

        return
            HomeBridgeErcToErc.initialize(
                _validatorContract,
                _dailyLimit,
                _maxPerTx,
                _minPerTx,
                _homeGasPrice,
                _requiredBlockConfirmations,
                _erc677token,
                _foreignDailyLimit,
                _foreignMaxPerTx,
                _owner,
                _feePercent
            );
    }

    function setFallbackRecipient(address _recipient) public onlyOwner {
        _setFallbackRecipient(_recipient);
    }

    function _setFallbackRecipient(address _recipient) internal {
        require(_recipient != address(0));
        addressStorage[keccak256(abi.encodePacked("fallbackRecipient"))] = _recipient;
    }

    function fallbackRecipient() public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("fallbackRecipient"))];
    }

    function transferAndCall(
        address _to,
        uint256 _value,
        bytes _data
    ) public payable returns (bool) {
        require(_to == address(this), "To address must be home bridge address");
        require(_value == msg.value, "Transfer value must equal to eth amount");
        require(withinLimit(_value), "Transfer limit exceeded.");
        require(_value > withdrawFixedFee(), "Value is less than fee");

        uint256 fee = withdrawFee(_value);
        if (fee != 0) {
            // transfer fee
            require(tokenTransfer(feeReceiver(), fee), "failed to transfer fee");
        }
        uint256 value = _value.sub(fee);

        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(value));
        fireEventOnTokenTransfer(msg.sender, value);
        return true;
    }

    function setErc677token(address _token) internal {
        require(_token == address(0));
        addressStorage[keccak256(abi.encodePacked("erc677token"))] = address(this);
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function balanceOf(address _user) public view returns (uint256) {
        return _user.balance;
    }

    function() public payable {
        transferAndCall(this, msg.value, "0x");
    }

    function tokenTransfer(address _to, uint256 _value)
        internal
        returns (bool)
    {
        return _to.send(_value);
    }

    function onExecuteAffirmation(address _recipient, uint256 _value)
        internal
        returns (bool)
    {
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_value));

        uint256 fee = depositFee(_value);
        if (_value <= fee) {
            tokenTransfer(feeReceiver(), _value);
            return true;
        }

        if (fee != 0) {
            tokenTransfer(feeReceiver(), fee);
        }

        uint256 value = _value.sub(fee);
        if (value != 0) {
            if (!tokenTransfer(_recipient, value)) {
                address _fallbackRecipient = fallbackRecipient();
                require(_fallbackRecipient != address(0), "fallback recipient was not assigned");
                _fallbackRecipient.transfer(value);
                emit RecipientRedirected(_recipient, _fallbackRecipient);
                return true;
            }
        }
        return true;
    }
}
