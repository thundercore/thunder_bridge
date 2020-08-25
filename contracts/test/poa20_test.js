const POA20 = artifacts.require("ERC677BridgeToken.sol");
const ERC677ReceiverTest = artifacts.require("ERC677ReceiverTest.sol")

const { expect } = require('chai')
const { ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS, BN } = require('./setup')
const { ether, expectEventInLogs } = require('./helpers/helpers')

const Web3Utils = require('web3-utils');
const HomeErcToErcBridge = artifacts.require("HomeBridgeErcToErc.sol");
const ForeignBridgeErcToErc = artifacts.require("ForeignBridgeErcToErc.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const minPerTx = ether('0.01')
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = ether('1')
const halfEther = ether('0.5')
const executionDailyLimit = oneEther
const executionMaxPerTx = halfEther
const ZERO = new BN(0)

contract('ERC677BridgeToken', async (accounts) => {
  let token
  let owner = accounts[0]
  const user = accounts[1];
  beforeEach(async () => {
    token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
  })
  it('default values', async () => {
    expect(await token.symbol()).to.be.equal('POA20')
    expect(await token.decimals()).to.be.bignumber.equal('18')
    expect(await token.name()).to.be.equal('POA ERC20 Foundation')
    expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
    expect(await token.mintingFinished()).to.be.equal(false)

    const { major, minor, patch } = await token.getTokenInterfacesVersion()
    expect(major).to.be.bignumber.gte(ZERO)
    expect(minor).to.be.bignumber.gte(ZERO)
    expect(patch).to.be.bignumber.gte(ZERO)
  })

  describe('#bridgeContract', async() => {
    it('can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;

      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('only owner can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: owner }).should.be.fulfilled;
      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('fail to set invalid bridge contract address', async () => {
      const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);
    })
  })

  describe('#mint', async() => {
    it('can mint by owner', async () => {
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      expect(await token.totalSupply()).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal('1')
    })

    it('no one can call finishMinting', async () => {
      await token.finishMinting().should.be.rejectedWith(ERROR_MSG)
    })

    it('cannot mint by non-owner', async () => {
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      await token.mint(user, 1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('#transfer', async() => {
    let homeErcToErcContract, foreignErcToErcContract, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]];
      const feePercent = '0';
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner, feePercent)
      foreignErcToErcContract = await ForeignBridgeErcToErc.new()
      await foreignErcToErcContract.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        executionMaxPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        owner,
        feePercent
      );
    });
    it('sends tokens to recipient', async () => {
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transfer(user, 1, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await token.transfer(owner, 1, {from: user}).should.be.fulfilled;

      expect(await token.balanceOf(owner)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expectEventInLogs(logs, 'Transfer', {
        from: user,
        to: owner,
        value: new BN(1)
      })
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(homeErcToErcContract.address, minPerTx, {from: user}).should.be.fulfilled;
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })
    })

    it('sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(validatorContract.address, minPerTx, {from: user}).should.be.fulfilled;
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
      expectEventInLogs(result.logs, 'ContractFallbackCallFailed', {
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = web3.utils.toBN(web3.utils.toWei('0.0001', "ether"))
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.transfer(homeErcToErcContract.address, lessThanMin, {from: user}).should.be.rejectedWith(ERROR_MSG);

      await token.setBridgeContract(foreignErcToErcContract.address).should.be.fulfilled;
      await token.transfer(foreignErcToErcContract.address, lessThanMin, {from: user}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe("#burn", async () => {
    it('can burn', async() => {
      await token.burn(100, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      await token.burn(1, { from: user }).should.be.fulfilled
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('#transferAndCall', () => {
    let homeErcToErcContract, foreignErcToErcContract, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]];
      const feePercent = '0';
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner, feePercent)
      foreignErcToErcContract = await ForeignBridgeErcToErc.new()
      await foreignErcToErcContract.initialize(
        validatorContract.address,
        token.address,
        requireBlockConfirmations,
        gasPrice,
        executionMaxPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        owner,
        feePercent
      );
    })
    it('calls contractFallback', async () => {
      const receiver = await ERC677ReceiverTest.new()
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)
      expect(await receiver.someVar()).to.be.bignumber.equal(ZERO)

      const callDoSomething123 = receiver.contract.methods.doSomething(123).encodeABI()

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transferAndCall(token.address, '1', callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token
        .transferAndCall(ZERO_ADDRESS, '1', callDoSomething123, { from: user })
        .should.be.rejectedWith(ERROR_MSG)
      await token.transferAndCall(receiver.address, '1', callDoSomething123, {from: user}).should.be.fulfilled;

      expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await receiver.from()).to.be.equal(user)
      expect(await receiver.value()).to.be.bignumber.equal('1')
      expect(await receiver.data()).to.be.equal(callDoSomething123)
      expect(await receiver.someVar()).to.be.bignumber.equal('123')
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transferAndCall(homeErcToErcContract.address, minPerTx, '0x', {from: user}).should.be.fulfilled;
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })
    })

    it('fail to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      await token.transferAndCall(validatorContract.address, minPerTx, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = web3.utils.toBN(web3.utils.toWei('0.0001', "ether"))
      await token.mint(user, web3.utils.toWei('1', "ether"), {from: owner }).should.be.fulfilled;

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.transferAndCall(homeErcToErcContract.address, lessThanMin, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);

      await token.setBridgeContract(foreignErcToErcContract.address).should.be.fulfilled;
      await token.transferAndCall(foreignErcToErcContract.address, lessThanMin, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })
  })
  describe('#claimtokens', async () => {
    it('can take send ERC20 tokens', async ()=> {
      const owner = accounts[0];
      const halfEther = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      let tokenSecond = await POA20.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(token.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))

      await token.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))

    })
  })
  describe('#transfer', async () => {
    it('if transfer called on contract, onTokenTransfer is also invoked', async () => {
      const receiver = await ERC677ReceiverTest.new();
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)
      expect(await receiver.someVar()).to.be.bignumber.equal(ZERO)

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      const {logs} = await token.transfer(receiver.address, 1, {from: user}).should.be.fulfilled;

      expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await receiver.from()).to.be.equal(user)
      expect(await receiver.value()).to.be.bignumber.equal('1')
      expect(await receiver.data()).to.be.equal(null)
      expect(logs[0].event).to.be.equal('Transfer')
    })
    it('if transfer called on contract, still works even if onTokenTransfer doesnot exist', async () => {
      const someContract = await POA20.new("Some", "Token", 18);
      await token.mint(user, 2, {from: owner }).should.be.fulfilled;
      const tokenTransfer = await token.transfer(someContract.address, 1, {from: user}).should.be.fulfilled;
      const tokenTransfer2 = await token.transfer(accounts[0], 1, {from: user}).should.be.fulfilled;
      expect(await token.balanceOf(someContract.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      tokenTransfer.logs[0].event.should.be.equal("Transfer")
      tokenTransfer2.logs[0].event.should.be.equal("Transfer")

    })
  })
})
