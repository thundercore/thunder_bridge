pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "./ForeignBridgeErcToErcV2.sol";

contract ForeignBridgeWithNativeToken is ForeignBridgeErcToErcV2 {

  string public constant name = "Bridged ETH";
  string public constant symbol = "BETH";
  uint8 public constant decimals = 18;

  event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
  );

  event RecipientRedirected(
    address indexed from,
    address indexed to
  );

  function setFallbackRecipient(address _recipient) public onlyIfOwnerOfProxy {
    require(_recipient != address(0));
    addressStorage[keccak256(abi.encodePacked("fallbackRecipient"))] = _recipient;
  }

  function fallbackRecipient() public view returns(address) {
    return addressStorage[keccak256(abi.encodePacked("fallbackRecipient"))];
  }

  function erc20token() public view returns(ERC20Basic) {
    if (this.isInitialized()) {
      return ERC20Basic(this);
    }
    return ERC20Basic(address(0));
  }

  function totalSupply() public view returns (uint256) {
    return address(this).balance;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address owner) public view returns (uint256) {
    return owner.balance;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param owner address The address which owns the funds.
   * @param spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(
    address owner,
    address spender
   )
    public
    view
    returns (uint256)
  {
    return 0;
  }

  /**
  * @dev Transfer token for a specified address
  * @param to The address to transfer to.
  * @param value The amount to be transferred.
  */
  function transfer(address to, uint256 value) public payable returns (bool) {
    if (to != address(this) || value != msg.value) {
      revert("reverted");
    }
    emit Transfer(msg.sender, this, msg.value);
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param spender The address which will spend the funds.
   * @param value The amount of tokens to be spent.
   */
  function approve(address spender, uint256 value) public returns (bool) {
    revert("reverted");
  }

  /**
   * @dev Transfer tokens from one address to another
   * @param from address The address which you want to send tokens from
   * @param to address The address which you want to transfer to
   * @param value uint256 the amount of tokens to be transferred
   */
  function transferFrom(
    address from,
    address to,
    uint256 value
  )
    public
    returns (bool)
  {
    revert("reverted");
  }

  function tokenTransfer(address _recipient, uint256 _amount) internal returns(bool) {
    return _recipient.send(_amount);
  }

  function onExecuteMessage(address _recipient, uint256 _amount) internal returns(bool){
      if (!tokenTransfer(_recipient, _amount)) {
        address _fallbackRecipient = fallbackRecipient();
        require(_fallbackRecipient != address(0), "fallback recipient was not assigned");
        msg.sender.transfer(_amount);
        emit RecipientRedirected(_recipient, _fallbackRecipient);
        emit Transfer(this, _fallbackRecipient, _amount);
        return true;
      }
      emit Transfer(this, _recipient, _amount);
      return true;
  }

  function claimTokens(address _token, address _to) public onlyIfOwnerOfProxy {
    // If _token is 0x0, super.claimTokens will transfer all balance of this contract
    // to target address. `require(_token != address(0))` can avoid this.
      require(_token != address(0));
      super.claimTokens(_token, _to);
  }

  function () public payable {
    emit Transfer(msg.sender, this, msg.value);
  }

}
