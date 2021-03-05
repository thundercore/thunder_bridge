const Web3Utils = require('web3-utils');
const HomeBridge = artifacts.require("HomeBridgeNativeToErcWithFee.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol");
const RevertFallback = artifacts.require("RevertFallback.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");

const {
  expect
} = require('chai')
const {
  ERROR_MSG,
  ZERO_ADDRESS,
  toBN
} = require('../setup')
const {
  getEvents,
  createMessage,
  sign,
  expectEventInLogs,
  ether
} = require('../helpers/helpers');

const minPerTx = ether('0.01')
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = ether('1')
const twoEther = ether('2')
const halfEther = ether('0.5')
const pointOneEther = ether('0.001')
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther
const FEE_PERCENT = '500'; // 5%
const ZERO = toBN(0)


contract('HomeBridge_ERC677_to_NATIVE', async (accounts) => {
  let homeContract, validatorContract, authorities, owner;
  const fallbackRecipient = accounts[9]
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#initialize', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })
    it('sets variables', async () => {
      expect(await homeContract.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.isInitialized()).to.be.equal(false)

      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.fulfilled;

      expect(await homeContract.isInitialized()).to.be.equal(true)
      expect(await homeContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await homeContract.minPerTx()).to.be.bignumber.equal('1')

      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      expect(await homeContract.getBridgeMode()).to.be.equal(bridgeMode)
      const {
        major,
        minor,
        patch
      } = await homeContract.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expect(await homeContract.feePercent()).to.be.bignumber.equal(FEE_PERCENT)
    })
    it('cant set maxPerTx > dailyLimit', async () => {
      expect(await homeContract.isInitialized()).to.be.equal(false)
      await homeContract.initialize(validatorContract.address, '1', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '2', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      expect(await homeContract.isInitialized()).to.be.equal(false)
    })

    it('can be deployed via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let data = homeContract.contract.methods.initialize(
          validatorContract.address,
          "3", "2", "1",
          gasPrice,
          requireBlockConfirmations,
          ZERO_ADDRESS,
          foreignDailyLimit.toString(),
          foreignMaxPerTx.toString(),
          owner,
          FEE_PERCENT,
          fallbackRecipient
          )
        .encodeABI()

      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled;
      let finalContract = await HomeBridge.at(storageProxy.address);

      expect(await finalContract.isInitialized()).to.be.equal(true)
      expect(await finalContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContract.minPerTx()).to.be.bignumber.equal('1')
    })

    it('cant initialize with invalid arguments', async () => {
      const token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '3', '2', '1', 0, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, 0, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(owner, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(ZERO_ADDRESS, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, token.address, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, owner, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, halfEther, oneEther, owner, FEE_PERCENT, fallbackRecipient).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.fulfilled;
      expect(await homeContract.isInitialized()).to.be.equal(true)
    })

    it('can set gas Price', async () => {
      // Given
      await homeContract.initialize(
        validatorContract.address,
        '3', '2', '1',
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      ).should.be.fulfilled;

      expect(await homeContract.gasPrice()).to.be.bignumber.equal(gasPrice)

      // When
      const newGasPrice = web3.utils.toWei('2', 'gwei')

      await homeContract.setGasPrice(newGasPrice, {
        from: accounts[2]
      }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setGasPrice(0, {
        from: owner
      }).should.be.rejectedWith(ERROR_MSG)
      const {
        logs
      } = await homeContract.setGasPrice(newGasPrice, {
        from: owner
      }).should.be.fulfilled

      // Then
      expect(await homeContract.gasPrice()).to.be.bignumber.equal(newGasPrice)
      expectEventInLogs(logs, 'GasPriceChanged', {
        gasPrice: newGasPrice
      })
    })
    it('can set Required Block Confirmations', async () => {
      // Given
      await homeContract.initialize(
        validatorContract.address,
        '3', '2', '1',
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      ).should.be.fulfilled;

      expect(await homeContract.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requireBlockConfirmations))

      // When
      const newRequiredBlockConfirmations = 15
      await homeContract
        .setRequiredBlockConfirmations(newRequiredBlockConfirmations, {
          from: accounts[2]
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setRequiredBlockConfirmations(0, {
        from: owner
      }).should.be.rejectedWith(ERROR_MSG)
      const {
        logs
      } = await homeContract.setRequiredBlockConfirmations(newRequiredBlockConfirmations, {
          from: owner
        })
        .should.be.fulfilled

      // Then
      expect(await homeContract.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(newRequiredBlockConfirmations))
      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(newRequiredBlockConfirmations)
      })
    })

    it('can transfer proxyOwnership', async () => {
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          '3', '2', '1',
          gasPrice,
          requireBlockConfirmations,
          ZERO_ADDRESS,
          foreignDailyLimit,
          foreignMaxPerTx,
          owner,
          FEE_PERCENT,
          fallbackRecipient
        ).encodeABI()
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      await storageProxy.transferProxyOwnership(owner).should.be.fulfilled

      expect(await storageProxy.version()).to.be.bignumber.equal(toBN('1'))
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        '3', '2', '1',
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )
    })

    it('should accept native coins', async () => {
      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const {
        logs
      } = await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')

      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient: accounts[1],
        value: toBN(1)
      })

      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled

      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(100).should.be.fulfilled
      await homeContract.setMaxPerTx(99).should.be.fulfilled
      // meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      // above daily limit
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not let to withdraw less than minPerTx', async () => {
      const newDailyLimit = 100
      const newMaxPerTx = 50
      const newMinPerTx = 20
      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled

      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx
      }).should.be.fulfilled
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: newMinPerTx - 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#setting limits', async () => {
    let homeContract;
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, {
        from: authorities[0]
      }).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMaxPerTx(2, {
        from: owner
      }).should.be.fulfilled;

      await homeContract.setMaxPerTx(3, {
        from: owner
      }).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, {
        from: authorities[0]
      }).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMinPerTx(1, {
        from: owner
      }).should.be.fulfilled;

      await homeContract.setMinPerTx(2, {
        from: owner
      }).should.be.rejectedWith(ERROR_MSG);
    })
    it('#setDailyLimit allow to set by owner', async () => {
      await homeContract.setDailyLimit(4, {
        from: authorities[0]
      }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4, {
        from: owner
      }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('4')

      await homeContract.setDailyLimit(0, {
        from: owner
      }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)

      await homeContract.setDailyLimit(4, {
        from: owner
      }).should.be.fulfilled
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('4')
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      await homeBridge.initialize(
        validatorContract.address,
        twoEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )

      await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
    })
    it('should allow validator to executeAffirmation', async () => {
      const recipient = accounts[5]
      const value = halfEther
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const {
        logs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
      const homeBalanceAfter = toBN(await web3.eth.getBalance(homeBridge.address))
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      homeBalanceAfter.should.be.bignumber.equal(ZERO)

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('should allow validator to executeAffirmation with zero value', async () => {
      const recipient = accounts[5]
      const value = ZERO
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const {
        logs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('test with 2 signatures required', async () => {
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        twoEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)

      const {
        logs
      } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      halfEther.should.be.bignumber.equal(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesThreeAccs[0]
        })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      expect(toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))).to.be.bignumber.equal(ZERO)

      expectEventInLogs(secondSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const senderHash = web3.utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesThreeAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      const processed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2))
      markedAsProcessed.should.be.bignumber.equal(processed)
    })
    it('should not allow to double submit', async () => {
      const recipient = accounts[5]
      const value = '1'
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: authorities[0]
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow non-authorities to execute withdraw', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: accounts[7]
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('doesnt allow to withdraw if requiredSignatures has changed', async () => {
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        twoEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = toBN(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5]
      const value = halfEther.div(toBN(2))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled
      expect(toBN(await web3.eth.getBalance(recipient))).to.be.bignumber.equal(balanceBefore.add(value))

      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesThreeAccs[2]
        })
        .should.be.rejectedWith(ERROR_MSG)

      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesThreeAccs[2]
        })
        .should.be.rejectedWith(ERROR_MSG)
      expect(toBN(await web3.eth.getBalance(recipient))).to.be.bignumber.equal(balanceBefore.add(value))
    })

    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        twoEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )

      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      await homeBridgeWithThreeSigs.sendTransaction({
        from: recipient,
        value: halfEther
      }).should.be.fulfilled

      const {
        logs
      } = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled

      expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should not allow execute affirmation over foreign max tx limit', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const {
        logs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should not allow execute affirmation over daily foreign limit', async () => {
      await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled

      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const {
        logs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const transactionHash2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const {
        logs: logs2
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs2, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash: transactionHash2
      })
      expectEventInLogs(logs2, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash: transactionHash2
      })

      const transactionHash3 = '0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712'
      const {
        logs: logs3
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash3, {
        from: authorities[0]
      })

      expectEventInLogs(logs3, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash3
      })

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()

      outOfLimitAmount.should.be.bignumber.equal(halfEther)

      const transactionHash4 = "0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196";
      const {
        logs: logs4
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash4, {
        from: authorities[0]
      }).should.be.fulfilled;

      expectEventInLogs(logs4, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash4
      })

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(oneEther)
    })
  })

  describe('#isAlreadyProcessed', async () => {
    it('returns ', async () => {
      homeBridge = await HomeBridge.new();
      const bn = toBN(2).pow(toBN(255))
      const processedNumbers = [bn.add(toBN(1)).toString(10), bn.add(toBN(100)).toString(10)];
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[0]));
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[1]));
      false.should.be.equal(await homeBridge.isAlreadyProcessed(10));
    })
  })

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures, authoritiesTwoAccs, ownerOfValidators, homeBridgeWithTwoSigs
    beforeEach(async () => {
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient);
    })
    it('allows a validator to submit a signature', async () => {
      var recipientAccount = accounts[8]
      var value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      const {
        logs
      } = await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authorities[0]
      }).should.be.fulfilled;
      logs[0].event.should.be.equal('SignedForUserRequest')
      const msgHashFromLog = logs[0].args.messageHash
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(msgHashFromLog, 0);
      const messageFromContract = await homeBridgeWithTwoSigs.message(msgHashFromLog);

      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(messageFromContract);
      const hashMsg = Web3Utils.soliditySha3(message);
      '1'.should.be.bignumber.equal(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg))
      const hashSenderMsg = Web3Utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg));
    })
    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      var recipientAccount = accounts[8]
      var value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      var homeGasPrice = web3.utils.toBN(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      const hashMsg = Web3Utils.soliditySha3(message);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[0]
      }).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[0]
      }).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[1]
      }).should.be.rejectedWith(ERROR_MSG);
      const {
        logs
      } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesTwoAccs[1]
      }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
      const processed = toBN(2).pow(toBN(255)).add(toBN(2))
      processed.should.be.bignumber.equal(await homeBridgeWithTwoSigs.numMessagesSigned(hashMsg))
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient);

      const value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address);
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      '3'.should.be.bignumber.equal(await validatorContractWith3Signatures.requiredSignatures());

      await homeBridgeWithThreeSigs.submitSignature(signature, message, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled;
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled;
      const {
        logs
      } = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })
    it('attack when increasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      var homeGasPrice = web3.utils.toBN(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[0]
      }).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[0]
      }).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[1]
      }).should.be.rejectedWith(ERROR_MSG);
      const {
        logs
      } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesTwoAccs[1]
      }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      '3'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const attackerTx = await homeBridgeWithTwoSigs.submitSignature(signature3, message, {
        from: authoritiesTwoAccs[2]
      }).should.be.rejectedWith(ERROR_MSG);
    })
    it('attack when decreasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
      var homeGasPrice = web3.utils.toBN(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesTwoAccs[0]
      }).should.be.fulfilled;
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const {
        logs
      } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesTwoAccs[1]
      }).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
    })
  })

  describe('#requiredMessageLength', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })

    it('should return the required message length', async () => {
      const requiredMessageLength = await homeContract.requiredMessageLength()
      '104'.should.be.bignumber.equal(requiredMessageLength)
    })
  })

  describe('#fixAssetsAboveLimits', async () => {
    let homeBridge;
    const zeroValue = web3.utils.toBN(web3.utils.toWei('0', "ether"))
    beforeEach(async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address);
      await homeBridge.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient).should.be.fulfilled
    })
    it('Should reduce outOfLimitAmount and not emit any event', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {
        logs: affirmationLogs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const {
        logs
      } = await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      logs.length.should.be.equal(0)

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })
    it('Should reduce outOfLimitAmount and emit UserRequestForSignature', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {
        logs: affirmationLogs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const {
        logs
      } = await homeBridge.fixAssetsAboveLimits(transactionHash, true).should.be.fulfilled

      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value
      })

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })
    it('Should not be allow to be called by an already fixed txHash', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const transactionHash2 = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value.add(value))

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.fulfilled

      const updatedOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      updatedOutOfLimitAmount.should.be.bignumber.equal(zeroValue)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if txHash didnt increase out of limit amount', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const invalidTxHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      const {
        logs: affirmationLogs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(invalidTxHash, true).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const {
        logs: affirmationLogs
      } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(transactionHash, true, {
        from: recipient
      }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash, true, {
        from: owner
      }).should.be.fulfilled
    })
  })
  describe('#OwnedUpgradeability', async () => {

    it('upgradeabilityAdmin should return the proxy owner', async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);

      const proxyOwner = await storageProxy.proxyOwner()
      const upgradeabilityAdmin = await homeBridge.upgradeabilityAdmin()

      upgradeabilityAdmin.should.be.equal(proxyOwner)
    })
  })
  describe('#Fee', async () => {
    it('Calculate fee as excepted', async () => {
      const homeBridge = await HomeBridge.new()
      await homeBridge.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient);

      // 5% + 5 fixed
      let fiveEther = Web3Utils.toWei('5', 'ether');
      let fivePercent = toBN(500);
      let fiftyEther = Web3Utils.toWei('50', 'ether');
      let twoKEther = Web3Utils.toWei('2000', 'ether');
      let hundredEther = Web3Utils.toWei('100', 'ether');
      let fee;

      const {
        logs
      } = await homeBridge.setDepositFixedFee(fiveEther);
      logs[0].event.should.be.equal('DepositFixedFeeChanged')
      logs[0].args.fixedFee.should.be.bignumber.equal(fiveEther);
      let fixedFeeFromContract = await homeBridge.depositFixedFee();
      fixedFeeFromContract.should.be.bignumber.equal(fiveEther);

      const {
        logs: logsDFP
      } = await homeBridge.setDepositFeePercent(fivePercent);
      logsDFP[0].event.should.be.equal('DepositFeePercentChanged')
      logsDFP[0].args.feePercent.should.be.bignumber.equal(fivePercent);
      let feePercentFromContract = await homeBridge.depositFeePercent();
      feePercentFromContract.should.be.bignumber.equal(fivePercent);

      fee = await homeBridge.depositFee(fiftyEther);
      fee.should.be.bignumber.equal(fiveEther);
      fee = await homeBridge.depositFee(twoKEther);
      fee.should.be.bignumber.equal(hundredEther);

      await homeBridge.setDepositFixedFee(ZERO);
      await homeBridge.setDepositFeePercent(ZERO);

      const {
        logs: logsWFF
      } = await homeBridge.setWithdrawFixedFee(fiveEther);
      logsWFF[0].event.should.be.equal('WithdrawFixedFeeChanged')
      logsWFF[0].args.fixedFee.should.be.bignumber.equal(fiveEther);
      fixedFeeFromContract = await homeBridge.withdrawFixedFee();
      fixedFeeFromContract.should.be.bignumber.equal(fiveEther);

      const {
        logs: logsWFP
      } = await homeBridge.setWithdrawFeePercent(fivePercent);
      logsWFP[0].event.should.be.equal('WithdrawFeePercentChanged')
      logsWFP[0].args.feePercent.should.be.bignumber.equal(fivePercent);
      feePercentFromContract = await homeBridge.withdrawFeePercent();
      feePercentFromContract.should.be.bignumber.equal(fivePercent);
      fee = await homeBridge.withdrawFee(fiftyEther);
      fee.should.be.bignumber.equal(fiveEther);
      fee = await homeBridge.withdrawFee(twoKEther);
      fee.should.be.bignumber.equal(hundredEther);
    })
    it('test with 2 signatures and fee', async () => {
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)

      let homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        oneEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        ether('10'),
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      );
      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled

      const token2sig = await ERC677BridgeToken.at(homeBridgeWithTwoSigs.address)
      const recipient = accounts[5];
      const feeReceiver = accounts[6];
      const value = halfEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await token2sig.balanceOf(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);
      const feeReceiverBalance = await token2sig.balanceOf(feeReceiver)

      // settle new fee scheme before starting
      await homeBridgeWithTwoSigs.setWithdrawFixedFee(pointOneEther);
      await homeBridgeWithTwoSigs.setFeeReceiver(feeReceiver);
      await homeBridgeWithTwoSigs.setDepositFeePercent(FEE_PERCENT);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesTwoAccs[0]
      }).should.be.fulfilled;
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(toBN(1));
      const {
        logs: execLogs
      } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesTwoAccs[1]
      }).should.be.fulfilled;
      expectEventInLogs(execLogs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const feeValue = await homeBridgeWithTwoSigs.depositFee(value)
      const balanceAfter = await token2sig.balanceOf(recipient);

      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value).sub(feeValue));
      const feeReceived = await token2sig.balanceOf(feeReceiver);
      feeReceived.should.be.bignumber.equal(feeReceiverBalance.add(feeValue));

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      const processed = toBN(2).pow(toBN(255)).add(toBN(2));
      markedAsProcessed.should.be.bignumber.equal(processed)

      // sent back to check
      const {logs} = await homeBridgeWithTwoSigs.sendTransaction({from: recipient, value})
      logs[0].event.should.be.equal("UserRequestForSignature")
      logs[0].args.recipient.should.be.bignumber.equal(recipient);
      logs[0].args.value.should.be.bignumber.equal(value.sub(pointOneEther));

      const feeReceivedAfter = await token2sig.balanceOf(feeReceiver);
      console.log(logs[0].args, feeReceivedAfter.toString())
      feeReceivedAfter.should.be.bignumber.equal(feeReceived.add(pointOneEther));
    })

    it('only owner can set fee percent', async () => {
      const homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner, FEE_PERCENT, fallbackRecipient);

      const newFeePercent = web3.utils.toBN('1337');
      const {
        logs
      } = await homeContract.setWithdrawFeePercent(newFeePercent);
      logs[0].event.should.be.equal('WithdrawFeePercentChanged')
      logs[0].args.feePercent.should.be.bignumber.equal(newFeePercent);
      const feePercentFromContract = await homeContract.withdrawFeePercent();
      feePercentFromContract.should.be.bignumber.equal(newFeePercent);

      await homeContract.setWithdrawFixedFee(newFeePercent, {
        from: accounts[5]
      }).should.be.rejectedWith(ERROR_MSG);

      await homeContract.setFeePercent(newFeePercent, {
        from: accounts[5]
      }).should.be.rejectedWith(ERROR_MSG);

      // deprecated old fee percent
      await homeContract.setFeePercent(newFeePercent).should.be.rejectedWith("Deprecated");
    })
  })

  describe('#fallbackRecipient', async () => {
    let homeBridge, token
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      await homeBridge.initialize(
        validatorContract.address,
        twoEther, halfEther, minPerTx,
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT,
        fallbackRecipient
      )

      await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled

      token = await ERC677BridgeToken.at(homeBridge.address)
    })

    it("send to reverted contract will send to fallback recipient", async()=> {
      let revertFallback = await RevertFallback.new();
      const recipient = revertFallback.address
      const value = halfEther
      const originBalance = await token.balanceOf(fallbackRecipient)

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      logs[1].event.should.be.equal("RecipientRedirected")
      logs[1].args.from.should.be.equal(recipient)
      logs[1].args.to.should.be.equal(fallbackRecipient)

      logs[2].event.should.be.equal("AffirmationCompleted")
      logs[2].args.recipient.should.be.equal(recipient)
      logs[2].args.value.should.be.bignumber.equal(value)
      logs[2].args.transactionHash.should.be.equal(transactionHash)

      const afterBalance = await token.balanceOf(fallbackRecipient)
      const fee = await homeBridge.depositFee(value)
      afterBalance.should.be.bignumber.equal(originBalance.add(value).sub(fee))
    })

    it("send to contract without revert will be success", async()=> {
      let v2 = await ForeignBridgeV2.new();
      const recipient = v2.address
      const value = halfEther
      const originBalance = await token.balanceOf(fallbackRecipient)

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const receipt = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      const logs = receipt.logs
      const afterBalance = await token.balanceOf(fallbackRecipient)
      afterBalance.should.be.bignumber.equal(originBalance)

      const fee = await homeBridge.depositFee(value)
      logs[1].event.should.be.equal("AffirmationCompleted")
      logs[1].args.recipient.should.be.equal(recipient)
      logs[1].args.value.should.be.bignumber.equal(value)
      logs[1].args.transactionHash.should.be.equal(transactionHash)

      const events = await getEvents(v2, {event: "FallbackReceived"})
      expect(events[0].returnValues.from).to.be.equal(homeBridge.address)
      expect(events[0].returnValues.amount).to.be.bignumber.equal(value.sub(fee))

      expect(await token.balanceOf(v2.address)).to.be.bignumber.equal(value.sub(fee))
    })
  })
})
