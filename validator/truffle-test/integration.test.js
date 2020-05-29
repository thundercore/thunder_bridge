const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const HomeBridge = artifacts.require('HomeBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const config = require(path.join(__dirname, '../config'))
const sender = require(path.join(__dirname, '../src/lib/sender'))
const receiptor = require(path.join(__dirname, '../src/lib/receiptor'))
const locker = require(path.join(__dirname, '../src/lib/locker'))
const utils = require('./utils')
const { expect } = require('chai')
const { stub } = require('sinon')

const w3 = utils.newWeb3()

const deployed = require(path.join(__dirname, '../../data/deployed.json'))


contract("Test complexity case", (accounts) => {
  const foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address);
  const home = new w3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address);
  const erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address);

  const l = new locker.FakeLocker()

  async function makeTransfer() {
    const receipt = await erc20.methods
      .transfer(foreign.options.address, w3.utils.toWei('0.01'))
      .send({ from: accounts[0] })
    return {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
  }

  async function getCurrentBlock() {
    return w3.eth.getBlockNumber()
  }

  it('test fill nonce if resent task was skipped', async () => {
    const task = await makeTransfer()

    await w3.miner.stop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [receiptorQ1, receiptorQ2, receiptorQ3] = await utils.newQueues(3)
    const [receiptor1, receiptor2, receiptor3] = await utils.newReceiptors(w3, 3)
    const [senderQ1, senderQ2, senderQ3] = await utils.newQueues(3)

    const r1 = await s1.run(task, receiptorQ1.sendToQueue)
    expect(r1).to.eq('success')
    await utils.makeOneBlock(w3)

    const r2 = await s2.run(task, receiptorQ2.sendToQueue)
    expect(r2).to.eq('success')
    const t3 = await s3.EventToTxInfo(task)
    await utils.makeOneBlock(w3)

    const snapshotId = await w3.miner.snapshot()

    const r3 = await s3.sendTx(t3, receiptorQ3.sendToQueue)
    expect(r3).to.eq('success')
    // s3 will failed due to enough affirmation
    await utils.makeOneBlock(w3, expectFail=true)

    await w3.miner.revert(snapshotId)

    await utils.futureBlock(w3, config.BLOCK_CONFIRMATION)

    const rr1 = await receiptor1.run(receiptorQ1.queue.pop(), senderQ1.sendToQueue)
    const rr2 = await receiptor2.run(receiptorQ2.queue.pop(), senderQ2.sendToQueue)
    const rr3 = await receiptor3.run(receiptorQ3.queue.pop(), senderQ3.sendToQueue)

    expect(rr1).to.equal("success")
    expect(rr2).to.equal("success")
    expect(senderQ1.queue).to.have.length(0)
    expect(senderQ2.queue).to.have.length(0)
    expect(rr3).to.equal("null")
    expect(senderQ3.queue).to.have.length(1)

    const resentTask = senderQ3.queue.pop()
    const oldNonce = await s3.readNonce(true)
    expect(oldNonce).to.eq(resentTask.nonce)

    // Sender.run will send a transaction to self in order to fill nonce while retry-task.
    const result = await s3.run(resentTask, receiptorQ3.sendToQueue)
    await utils.makeOneBlock(w3)

    // resent task will be skipped due to enough affirmation
    expect(result).to.be.eq('skipped')
    const newNonce = await s3.readNonce(true)

    // Make sure old nonce was filled
    expect(newNonce).to.gt(resentTask.nonce)
  })

  afterEach(async () => {
    await w3.miner.start()
  })
})