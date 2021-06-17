pragma solidity 0.4.24;

import "./ForeignBridgeErcToErcV2.sol";

interface EIP20NonStandardInterface {
  function transfer(address to, uint value) external;
}

contract ForeignBridgeErcToErcV3 is ForeignBridgeErcToErcV2 {
    event RecipientRedirected(address indexed from, address indexed to);

    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256 _maxPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner,
        uint256 _feePercent,
        address _fallbackRecipient
    ) public returns (bool) {
        _setFallbackRecipient(_fallbackRecipient);

        return
            ForeignBridgeErcToErcV2.initialize(
                _validatorContract,
                _erc20token,
                _requiredBlockConfirmations,
                _gasPrice,
                _maxPerTx,
                _homeDailyLimit,
                _homeMaxPerTx,
                _owner,
                _feePercent
            );
    }

    function _setFallbackRecipient(address _recipient) internal {
        require(_recipient != address(0));
        addressStorage[
            keccak256(abi.encodePacked("fallbackRecipient"))
        ] = _recipient;
    }

    function fallbackRecipient() public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("fallbackRecipient"))];
    }

    function onExecuteMessage(address _recipient, uint256 _amount)
        internal
        returns (bool)
    {
        if (!tokenTransfer(_recipient, _amount)) {
            address _fallbackRecipient = fallbackRecipient();
            require(
                _fallbackRecipient != address(0),
                "fallback recipient was not assigned"
            );
            tokenTransfer(_fallbackRecipient, _amount);
            emit RecipientRedirected(_recipient, _fallbackRecipient);
            return true;
        }
        return true;
    }
}