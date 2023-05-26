const { expect } = require('chai');

const { ZERO_ADDRESS, BN } = require('./setup')

const ERC677InitializableTokenV2  = artifacts.require('ERC677InitializableTokenV2.sol')
const ERC677ReceiverTest = artifacts.require('ERC677ReceiverTest.sol')

contract('ERC677InitializableTokenV2', async ([owner, ...users]) => {
  let token;
  let receiver;
  const user = users[3];
  const userInitialTokens = 1000;

  beforeEach(async () => {
    token = await ERC677InitializableTokenV2.new()
    receiver = await ERC677ReceiverTest.new()
    await token.initialize('FaDaChai', 'FDC', 3, owner)
    await token.mint(user, userInitialTokens)
  })

  async function expectReceiverState(lastTriggerAddress, lastTriggerValue) {
    expect(await receiver.from()).to.be.equal(lastTriggerAddress)
    expect(await receiver.value()).to.be.bignumber.that.eq(new BN(lastTriggerValue))
  }

  async function expectReceiverAsInititalState() {
    return await expectReceiverState(ZERO_ADDRESS, 0)
  }

  it('Should not trigger onTokenTransfer if receiver not in allow-list', async () => {
    await expectReceiverAsInititalState()

    await token.transfer(receiver.address, userInitialTokens, { from: user })

    // Expect transfer success but receiver state keeps unchanged
    expect(await token.balanceOf(user)).to.be.bignumber.that.is.zero
    await expectReceiverAsInititalState()
  })

  it('Should trigger onTokenTransfer if receiver is in allow-list', async () => {
    await token.enableTransferCallback(receiver.address)
    await expectReceiverAsInititalState()

    // Happy path to trigger receiver's onTokenTransfer
    await token.transfer(receiver.address, 40, { from: user })
    expect(await token.balanceOf(user)).to.be.bignumber.that.is.eq(new BN(userInitialTokens - 40))
    await expectReceiverState(user, 40)

    // Trigger onTokenTransfer but failed
    await receiver.setCallbackFailure(true)
    let lastError = ''
    await token.transfer(receiver.address, 100, { from: user })
      .catch(({ reason }) => {
        lastError = reason
      })
    expect(lastError).to.equal('Invoke transfer callback failed')
    await expectReceiverState(user, 40)

    // Remove contract from allow-list, expect callback is no longer been invoked
    await token.disableTransferCallback(receiver.address)
    await token.transfer(receiver.address, 20, { from: user })
    expect(await token.balanceOf(user)).to.be.bignumber.that.is.eq(new BN(userInitialTokens - 40 - 20))
    await expectReceiverState(user, 40)
  })
})
