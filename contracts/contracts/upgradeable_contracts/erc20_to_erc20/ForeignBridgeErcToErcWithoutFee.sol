
import "../erc20_to_erc20/ForeignBridgeErcToErc.sol";

contract ForiegnBridgeErcToErcWithFee is ForeignBridgeErcToErc {
    function onExecuteMessage(address _recipient, uint256 _amount) internal returns(bool){
        setTotalExecutedPerDay(getCurrentDay(), totalExecutedPerDay(getCurrentDay()).add(_amount));

        // don't care about fee.
        return tokenTransfer(_recipient, _amount);
    }
}
