const ForeignBridge = artifacts.require("ForeignBridgeWithNativeToken.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const TetherToken = artifacts.require("TetherToken.sol");

const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol");
const {ERROR_MSG, ZERO_ADDRESS, INVALID_ARGUMENTS, toBN} = require('../setup');
const {createMessage, sign, signatureToVRS, expectEventInLogs} = require('../helpers/helpers');
const halfEther = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
const requireBlockConfirmations = 8;
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = web3.utils.toBN(web3.utils.toWei('1', "ether"));
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const maxPerTx = halfEther
const FEE_PERCENT = '500'; // 5%

const { expect } = require('chai')
const ZERO = toBN(0)

async function balanceOf(account) {
  return toBN(await web3.eth.getBalance(account))
}

contract('ForeignBridge_NATIVE_to_ERC20', async (accounts) => {
  let validatorContract, authorities, owner, token;

  mint = async (recipient, value) => {
    if (!owner)
      throw new Error('owner not assigned')
    return await web3.eth.sendTransaction({from: owner, to: recipient, value})
  }

  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let foreignBridge =  await ForeignBridge.new();

      expect(await foreignBridge.erc20token()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.isInitialized()).to.be.equal(false)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)

      await foreignBridge.initialize(ZERO_ADDRESS, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, ZERO_ADDRESS, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, owner, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, 0, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, 0, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(owner, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT).should.be.rejectedWith(ERROR_MSG);

      const { logs } = await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT);

      expect(await foreignBridge.erc20token()).to.be.equal(foreignBridge.address)
      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(
        requireBlockConfirmations.toString()
      )

      expect(await foreignBridge.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      expect(await foreignBridge.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await foreignBridge.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)
      expect(await foreignBridge.feePercent()).to.be.bignumber.equal(FEE_PERCENT)
    })
  })

  describe('#executeSignatures', async () => {
    var value = web3.utils.toBN(web3.utils.toWei('0.25', "ether"));
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      const feePercent = '0';
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, feePercent);
      await mint(foreignBridge.address, value)
    })

    it('should allow to executeSignatures', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await balanceOf(recipientAccount)

      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      const {logs} = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // Transfer from bridge address to recipientAccount
      logs[0].event.should.be.equal("Transfer")
      logs[0].args.from.should.be.equal(foreignBridge.address)
      logs[0].args.to.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)

      logs[1].event.should.be.equal("RelayedMessage")
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)

      const balanceAfter = await balanceOf(recipientAccount);
      const balanceAfterBridge = await balanceOf(foreignBridge.address);
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.equal(ZERO)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })

    it('should allow second withdrawal with different transactionHash but same recipient and value', async ()=> {
      var recipientAccount = accounts[3];
      const balanceBefore = await balanceOf(recipientAccount)
      // tx 1
      var value = toBN(web3.utils.toWei('0.25', "ether"));
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      await mint(foreignBridge.address, value);
      var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
      var message2 = createMessage(recipientAccount, value, transactionHash2, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
      const {logs} = await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal("Transfer")
      logs[0].args.from.should.be.equal(foreignBridge.address)
      logs[0].args.to.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)

      logs[1].event.should.be.equal("RelayedMessage")
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(toBN(2))))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })

    it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
      var recipientAccount = accounts[3];
      // tx 1
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridge.address);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      await mint(foreignBridge.address,value);
      var message2 = createMessage(accounts[4], value, transactionHash, foreignBridge.address);
      var signature2 = await sign(authorities[0], message2)
      var vrs = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
    })

  })

  describe('#withdraw with 2 minimum signatures', async () => {
    let multisigValidatorContract, twoAuthorities, ownerOfValidatorContract, foreignBridgeWithMultiSignatures
    var value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));

    beforeEach(async () => {
      multisigValidatorContract = await BridgeValidators.new()
      twoAuthorities = [accounts[0], accounts[1]];
      ownerOfValidatorContract = accounts[3]
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {from: ownerOfValidatorContract})
      foreignBridgeWithMultiSignatures = await ForeignBridge.new()
      await foreignBridgeWithMultiSignatures.initialize(multisigValidatorContract.address, foreignBridgeWithMultiSignatures.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT, {from: ownerOfValidatorContract});
      await mint(foreignBridgeWithMultiSignatures.address, value);
    })

    it('withdraw should fail if not enough signatures are provided', async () => {

      var recipientAccount = accounts[4];
      // msg 1
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
      // msg 2
      var signature2 = await sign(twoAuthorities[1], message)
      var vrs2 = signatureToVRS(signature2);
      const {logs} = await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], message).should.be.fulfilled;

      logs[0].event.should.be.equal("Transfer")
      logs[0].args.from.should.be.equal(foreignBridgeWithMultiSignatures.address)
      logs[0].args.to.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[1].event.should.be.equal("RelayedMessage")
      logs[1].args.recipient.should.be.equal(recipientAccount)
      logs[1].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))

    })
    it('withdraw should fail if duplicate signature is provided', async () => {
      var recipientAccount = accounts[4];
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, foreignBridgeWithMultiSignatures.address);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })

    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)
      const value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()

      await foreignBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, foreignBridgeWithThreeSigs.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT);
      await mint(foreignBridgeWithThreeSigs.address, value);

      const txHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(recipient, value, txHash, foreignBridgeWithThreeSigs.address);

      // signature 1
      const signature = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature);

      // signature 2
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2);

      // signature 3
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3);


      const {logs} = await foreignBridgeWithThreeSigs.executeSignatures([vrs.v, vrs2.v, vrs3.v], [vrs.r, vrs2.r, vrs3.r], [vrs.s, vrs2.s, vrs3.s], message).should.be.fulfilled;
      logs[0].event.should.be.equal("Transfer")
      logs[0].args.from.should.be.equal(foreignBridgeWithThreeSigs.address)
      logs[0].args.to.should.be.equal(recipient)
      logs[0].args.value.should.be.bignumber.equal(value)

      logs[1].event.should.be.equal("RelayedMessage")
      logs[1].args.recipient.should.be.equal(recipient)
      logs[1].args.value.should.be.bignumber.equal(value)
      true.should.be.equal(await foreignBridgeWithThreeSigs.relayedMessages(txHash))
    })
  })

  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER  = accounts[0]
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled;
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled;
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address);
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled;

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled;
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled;

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address);
      await foreignBridgeProxy.initialize(validatorsProxy.address, foreignBridgeProxy.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT)

      // Deploy V2
      let foreignImplV2 = await ForeignBridgeV2.new();
      let foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address);
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled;
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())

      let foreignBridgeV2Proxy = await ForeignBridgeV2.at(foreignBridgeProxy.address)
      await foreignBridgeV2Proxy.doSomething(accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeV2Proxy.doSomething(accounts[2], {from: PROXY_OWNER}).should.be.fulfilled;
      (await foreignBridgeV2Proxy.something()).should.be.equal(accounts[2])
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const validatorsAddress = validatorContract.address

      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let foreignBridge =  await ForeignBridge.new();
      const data = foreignBridge.contract.methods.initialize(
        validatorsAddress,
        foreignBridge.address,
        requireBlockConfirmations,
        gasPrice,
        maxPerTx.toString(),
        homeDailyLimit.toString(),
        homeMaxPerTx.toString(),
        owner,
        FEE_PERCENT)
        .encodeABI()

      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled;
      let finalContract = await ForeignBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      validatorsAddress.should.be.equal(await finalContract.validatorContract())
    })
  })

  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0];
      const foreignBridgeImpl = await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address);
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT);

      let tokenSecond = await ERC677BridgeToken.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(foreignBridge.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
  })

  describe('# test foreign bridge v2', () => {
    it('home daily limit was remove in v2', async () => {
      const recipientAccount = accounts[3];
      const foreignBridge = await ForeignBridge.new()
      const feePercent = '0';
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, feePercent);
      await mint(foreignBridge.address, web3.utils.toBN(web3.utils.toWei('5', "ether")));

      const transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const message = createMessage(recipientAccount, halfEther, transactionHash, foreignBridge.address);
      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled

      const transactionHash2 = "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const message2 = createMessage(recipientAccount, halfEther, transactionHash2, foreignBridge.address);
      const signature2 = await sign(authorities[0], message2)
      const vrs2 = signatureToVRS(signature2);

      await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      const transactionHash3 = "0x022695428093bb292db8e48bd1417c5e1b84c0bf673bd0fff23ed0fb6495b872";
      const message3 = createMessage(recipientAccount, halfEther, transactionHash3, foreignBridge.address);
      const signature3 = await sign(authorities[0], message3)
      const vrs3 = signatureToVRS(signature3);

      await foreignBridge.executeSignatures([vrs3.v], [vrs3.r], [vrs3.s], message3).should.be.fulfilled
    })
    it('setExecutionDailyLimit was deprecated', async () => {
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.setExecutionDailyLimit('10000').should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('# test foreign bridge with native token', () => {
    var value = web3.utils.toBN(web3.utils.toWei('0.25', "ether"));
    const owner = accounts[0];

    let foreignBridge
    beforeEach(async () => {
      const foreignBridgeImpl = await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled

      foreignBridge = await ForeignBridge.at(storageProxy.address);
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT);
      await mint(foreignBridge.address, value)
    })

    it('test DetailedERC20', async () => {
      expect(await foreignBridge.name()).to.be.equal('Bridged ETH')
      expect(await foreignBridge.symbol()).to.be.equal('BETH')
      expect(await foreignBridge.decimals()).to.be.bignumber.equal(toBN(18))
    })

    it('transfer eth to contract should emit `Transfer` event', async () => {
      const sender = accounts[3]
      const receipt = await web3.eth.sendTransaction({from: sender, to: foreignBridge.address, value})

      const logs = await foreignBridge.getPastEvents('Transfer', {
        filter: {from: sender, to: foreignBridge.address, value},
        fromBlock: receipt.blockNumber,
        toBlock:  receipt.blockNumber
      })

      logs[0].event.should.be.equal("Transfer")
      logs[0].args.from.should.be.equal(sender)
      logs[0].args.to.should.be.equal(foreignBridge.address)
      logs[0].args.value.should.be.bignumber.equal(value)
    })

    it('test reverted functions', async () => {
      await foreignBridge.transfer(accounts[3], value).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.approve(accounts[3], value).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.transferFrom(owner, accounts[3], value).should.be.rejectedWith(ERROR_MSG)
    })

    it('test balanceOf', async () => {
      const balance = await foreignBridge.balanceOf(foreignBridge.address)
      balance.should.be.bignumber.equal(value)

      const ethBalance = await web3.eth.getBalance(accounts[3])
      const tokenBalance = await foreignBridge.balanceOf(accounts[3])
      ethBalance.should.be.bignumber.equal(toBN(tokenBalance))
    })

    it('test total supply', async () => {
      const supply = await foreignBridge.totalSupply()
      supply.should.be.bignumber.equal(value)
    })

    it('if send eth failed, redirect eth to the fallback recipient', async () => {
      let foreignImplV2 = await ForeignBridgeV2.new();
      const recipient = foreignImplV2.address
      const validator = authorities[0]
      const fallbackRecipient = accounts[6]

      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipient, value, transactionHash, foreignBridge.address);
      var signature = await sign(validator, message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))

      // revert if fallback recipient was not assigned
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message, {from: validator}).should.be.rejectedWith(ERROR_MSG)

      await foreignBridge.setFallbackRecipient(fallbackRecipient)
      const {logs} = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message, {from: validator}).should.be.fulfilled

      // ForeignBridgeV2 will revert this transfer, so contract will redirect to the sender.
      logs[0].event.should.be.equal("RecipientRedirected")
      logs[0].args.from.should.be.equal(recipient)
      logs[0].args.to.should.be.equal(fallbackRecipient)

      logs[1].event.should.be.equal("Transfer")
      logs[1].args.from.should.be.equal(foreignBridge.address)
      logs[1].args.to.should.be.equal(fallbackRecipient)
      logs[1].args.value.should.be.bignumber.equal(value)

      logs[2].event.should.be.equal("RelayedMessage")
      logs[2].args.recipient.should.be.equal(recipient)
      logs[2].args.value.should.be.bignumber.equal(value)

    })

    it('claim native token should be revert', async () => {
      const owner = accounts[0];
      const foreignBridgeImpl = await ForeignBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled
      const foreignBridge = await ForeignBridge.at(storageProxy.address);
      await foreignBridge.initialize(validatorContract.address, foreignBridge.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT);

      let tokenSecond = await ERC677BridgeToken.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(foreignBridge.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))

      // Claim token with zero address will be rejected
      await foreignBridge.claimTokens(ZERO_ADDRESS, accounts[3], {from: owner}).should.be.rejectedWith(ERROR_MSG)

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
  })
})