pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "../libraries/SafeMath.sol";
import "./OwnedUpgradeability.sol";
import "./Ownable.sol";

contract DepositWithdrawFeeManager is EternalStorage, Ownable {
    using SafeMath for uint256;

    event FeeReceiverChange(address receiver);

    event WithdrawFixedFeeChanged(uint fixedFee);
    event WithdrawFeePercentChanged(uint feePercent);

    event DepositFixedFeeChanged(uint fixedFee);
    event DepositFeePercentChanged(uint feePercent);

    function setFeeReceiver(address _receiver) public onlyOwner {
        addressStorage[keccak256(abi.encodePacked("feeReceiver"))] = _receiver;
        emit FeeReceiverChange(_receiver);
    }

    function feeReceiver() public view returns(address) {
        return addressStorage[keccak256(abi.encodePacked("feeReceiver"))];
    }

    function setWithdrawFixedFee(uint256 _fixedFee) public onlyOwner {
        uintStorage[keccak256(abi.encodePacked("withdrawFixedFee"))] = _fixedFee;
        emit WithdrawFixedFeeChanged(_fixedFee);
    }

    function withdrawFixedFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("withdrawFixedFee"))];
    }

    function setWithdrawFeePercent(uint256 _feePercent) public onlyOwner {
        require(_feePercent < 10000, "Invalid fee percent");
        uintStorage[keccak256(abi.encodePacked("withdrawFeePercent"))] = _feePercent;
        emit WithdrawFeePercentChanged(_feePercent);
    }

    function withdrawFeePercent() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("withdrawFeePercent"))];
    }

    function withdrawFee(uint256 _value) public view returns(uint256) {
        uint256 minFee = withdrawFixedFee();
        uint256 fullPercent = 10000;
        uint256 percentageFee = _value.mul(withdrawFeePercent()).div(fullPercent);
        if (minFee > percentageFee) {
            return minFee;
        } else {
            return percentageFee;
        }
    }

    function setDepositFixedFee(uint256 _fixedFee) public onlyOwner {
        uintStorage[keccak256(abi.encodePacked("depositFixedFee"))] = _fixedFee;
        emit DepositFixedFeeChanged(_fixedFee);
    }

    function depositFixedFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("depositFixedFee"))];
    }

    function setDepositFeePercent(uint256 _feePercent) public onlyOwner {
        require(_feePercent < 10000, "Invalid fee percent");
        uintStorage[keccak256(abi.encodePacked("depositFeePercent"))] = _feePercent;
        emit DepositFeePercentChanged(_feePercent);
    }

    function depositFeePercent() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("depositFeePercent"))];
    }

    function depositFee(uint256 _value) public view returns(uint256) {
        uint256 minFee = depositFixedFee();
        uint256 fullPercent = 10000;
        uint256 percentageFee = _value.mul(depositFeePercent()).div(fullPercent);
        if (minFee > percentageFee) {
            return minFee;
        } else {
            return percentageFee;
        }
    }
}
