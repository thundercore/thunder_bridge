pragma solidity 0.4.24;

import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./IFundableBurnableMintableERC677Token.sol";
import "./IMinterBurner.sol";

/*
 * There are three roles.
 * 1. operator: minter, burner
 * 3. contract owner: add/remove operator, callToken, setting limit
 */
contract MinterBurnerProxy is Ownable {
  address public token;
  address public thunderBridge;
  uint256 public thunderBridgeSupply;

  mapping(address => bool) public operators;

  uint256 public perMintLimit;
  uint256 public dailyMintLimit;
  mapping(address => uint256) public operatorDailyMintLimit;

  mapping(uint256 => uint256) public totalDailyMinted;
  mapping(address => mapping(uint256 => uint256)) public operatorDailyMinted;

  event PerMintLimitChanged(uint256 prev, uint256 current);
  event OperatorDailyMintLimitChanged(uint256 prev, uint256 current, address operator);
  event DailyMintLimitChanged(uint256 prev, uint256 current);

  uint256 public perBurnLimit;
  uint256 public dailyBurnLimit;
  mapping(address => uint256) public operatorDailyBurnLimit;

  mapping(uint256 => uint256) public totalDailyBurned;
  mapping(address => mapping(uint256 => uint256)) public operatorDailyBurned;

  event PerBurnLimitChanged(uint256 prev, uint256 current);
  event OperatorDailyBurnLimitChanged(uint256 prev, uint256 current, address operator);
  event DailyBurnLimitChanged(uint256 prev, uint256 current);

  event OperatorAdded(address operator);
  event OperatorRemoved(address operator);

  modifier isOperator() {
      require(operators[msg.sender] == true);
      _;
  }

  function initialize(address _token, address _bridgeAddress) public initializer {
    Ownable.initialize(msg.sender);

    token = _token;
    thunderBridge = _bridgeAddress;
    operators[_bridgeAddress] = true;
  }

  function minterBurner() view internal returns (IMinterBurner) {
    return IMinterBurner(token);
  }

  // Owner function

  function addOperator(address addr) external onlyOwner {
    emit OperatorAdded(addr);
    operators[addr] = true;
  }

  function removeOperator(address addr) external onlyOwner {
    emit OperatorRemoved(addr);
    delete operators[addr];
  }

  function callToken(bytes data) external payable onlyOwner returns (bool) {
    require(token.call.value(msg.value)(data));
    return true;
  }

  function setThunderBridgeSupply(uint256 amount) public onlyOwner {
    thunderBridgeSupply = amount;
  }

  // Limit setting functions

  function setDailyMintLimit(uint256 amount) external onlyOwner {
    emit DailyMintLimitChanged(dailyMintLimit, amount);
    dailyMintLimit = amount;
  }

  function setPerMintLimit(uint256 amount) external onlyOwner {
    emit PerMintLimitChanged(perMintLimit, amount);
    perMintLimit = amount;
  }

  function setOperatorDailyMintLimit(uint256 amount, address operator) external onlyOwner {
    emit OperatorDailyMintLimitChanged(operatorDailyMintLimit[operator], amount, operator);
    operatorDailyMintLimit[operator] = amount;
  }

  function setDailyBurnLimit(uint256 amount) external onlyOwner {
    emit DailyBurnLimitChanged(dailyBurnLimit, amount);
    dailyBurnLimit = amount;
  }

  function setPerBurnLimit(uint256 amount) external onlyOwner {
    emit PerBurnLimitChanged(perBurnLimit, amount);
    perBurnLimit = amount;
  }

  function setOperatorDailyBurnLimit(uint256 amount, address operator) external onlyOwner {
    emit OperatorDailyBurnLimitChanged(operatorDailyBurnLimit[operator], amount, operator);
    operatorDailyBurnLimit[operator] = amount;
  }

  // Operator functions, or co-minter functions.
  function mint(address _to, uint256 _value) public isOperator returns (bool) {
    if (perMintLimit > 0) {
      require(_value <= perMintLimit, "Exceed per mint limit");
    }
    if (operatorDailyMintLimit[msg.sender] > 0) {
      require(_value + operatorDailyMinted[msg.sender][getCurrentDay()] <= operatorDailyMintLimit[msg.sender], "Exceed operator day limit");
    }
    if (dailyMintLimit > 0) {
      require(_value + totalDailyMinted[getCurrentDay()] <= dailyMintLimit, "Exceed day limit");
    }

    bool res = minterBurner().mint(_to, _value);
    if (res) {
      if (msg.sender == thunderBridge) {
        thunderBridgeSupply += _value;
      }
      totalDailyMinted[getCurrentDay()] += _value;
      operatorDailyMinted[msg.sender][getCurrentDay()] += _value;
    }

    return res;
  }

  function burn(address _who, uint256 _value) public isOperator {
    if (perBurnLimit > 0) {
      require(_value <= perBurnLimit, "Exceed per burn limit");
    }
    if (operatorDailyBurnLimit[msg.sender] > 0) {
      require(_value + operatorDailyBurned[msg.sender][getCurrentDay()] <= operatorDailyBurnLimit[msg.sender], "Exceed operator day limit");
    }
    if (dailyBurnLimit > 0) {
      require(_value + totalDailyBurned[getCurrentDay()] <= dailyBurnLimit, "Exceed day limit");
    }

    minterBurner().burn(_who, _value);
    if (msg.sender == thunderBridge) {
      thunderBridgeSupply -= _value;
    }
    totalDailyBurned[getCurrentDay()] += _value;
    operatorDailyBurned[msg.sender][getCurrentDay()] += _value;
  }

  // Utility function
  function getCurrentDay() public view returns(uint256) {
    return now / 1 days;
  }
}