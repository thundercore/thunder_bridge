const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const HomeBridge = artifacts.require('HomeBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const storage = require(path.join(__dirname, '../src/lib/storage'))
const { expect } = require('chai')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))
const utils = require('./utils')

const w3 = utils.newWeb3()

const foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
const home = new w3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address)
const erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)


contract("Test single sender", (accounts) => {
  let q;
  beforeEach(async () => {
    q = await utils.newQueue()
  })

  it('test transfer success', async () => {
    const task = await utils.makeTransfer(accounts[0])

    const [s] = await utils.newSenders(w3, 1)
    const nonce = await s.readNonce(true)
    const currentBlock = await w3.eth.getBlockNumber()

    // Send task first time with success result
    let ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq('success')
    expect(q.queue).to.have.length(1)

    const receiptTask = q.queue.pop()
    expect(receiptTask.eventTask).to.be.deep.eq(task)
    expect(receiptTask.nonce).to.eq(nonce)
    expect(receiptTask.sentBlock).to.eq(currentBlock+1)
    expect(receiptTask.transactionHash).to.have.length(66)

    // Send task second time with skipped result
    ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq('skipped')
    expect(q.queue).to.have.length(0)
  })

  it('test transfer with lower nonce will be failed', async () => {
    const task = await utils.makeTransfer(accounts[0])

    const c = new storage.FakeCache()
    const [s] = await utils.newSenders(w3, 1)
    s.cache = c
    // Get and fix nonce to nonce-1.
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, (nonce - 1).toString())

    const ret = await s.run(task, q.sendToQueue)
    // Expect ret == nonceTooLow and nonce will be updated to nonce
    expect(ret).to.eq(sender.SendResult.nonceTooLow)
    expect(await c.get(s.nonceKey)).to.equal(nonce.toString())
    expect(q.queue).to.have.length(0)
  })

  it.skip("test tx was imported", async () => {
    // FIXME: truffle will return `the tx doesn't have the correct nonce` message.
    // It's different from geth. We skiped this test before we found a better way to test this case.
    const task = await utils.makeTransfer(accounts[0])

    const [s] = await utils.newSenders(w3, 1)
    const info = await s.EventToTxInfo(task)

    const p1 = s.sendTx(info, q.sendToQueue)
    const p2 = s.sendTx(info, q.sendToQueue)
    await utils.makeOneBlock(w3)

    const r1 = await p1
    const r2 = await p2
    expect(r1).to.be.eq("success")
    expect(q.queue).to.have.length(1)
    expect(r2).to.be.eq(sender.SendResult.txImported)
  })

  it('test gas limit exceeded', async () => {
    // TODO: maybe run another chain?
    const task = await utils.makeTransfer(accounts[0])
    const [s] = await utils.newSenders(w3, 1)
    const info = await s.EventToTxInfo(task)
    info.gasEstimate = 100000000000000

    const ret = await s.sendTx(info, q.sendToQueue)
    expect(ret).to.eq(sender.SendResult.blockGasLimitExceeded)
    expect(q.queue).to.have.length(0)
  })

  it('test transfer with same nonce will be fail', async () => {
    const task = await utils.makeTransfer(accounts[0])

    const c = new storage.FakeCache()
    const [s] = await utils.newSenders(w3, 1)
    s.cache = c
    // Fix nonce to same value
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, nonce)

    // First task will be success
    let ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq('success')

    // Second task with same nonce will be fail.
    const newtask = await utils.makeTransfer(accounts[0])
    await c.set(s.nonceKey, nonce)
    ret = await s.run(newtask, q.sendToQueue)
    expect(ret).to.eq(sender.SendResult.nonceTooLow)
    expect(await c.get(s.nonceKey)).to.eq((nonce + 1).toString())
    // Task is not `acked` in queue

    expect(q.queue).to.have.length(1)
  })
})

contract('Test multiple senders', (accounts) => {
  it('test third sender estimateGas will failed', async () => {
    const task = await utils.makeTransfer(accounts[0])

    await w3.miner.stop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [q1, q2] = await utils.newQueues(2)

    // s1 and s2 vote first
    // EventToTxInfo will run estimateGas.
    const info1 = await s1.EventToTxInfo(task)
    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    expect(r1).to.eq('success')
    await utils.makeOneBlock(w3)
    const receipt1 = await utils.getReceiptFromSenderQueue(w3, q1.queue)
    expect(receipt1.status).to.be.true

    const info2 = await s2.EventToTxInfo(task)
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    expect(r2).to.eq('success')
    await utils.makeOneBlock(w3)

    // We expect gasR2 > gasR1 due to enough affirmations.
    expect(info2.gasEstimate).to.gt(info1.gasEstimate)

    const receipt2 = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(receipt2.gasUsed).to.gt(receipt1.gasUsed)
    expect(receipt2.status).to.be.true

    // v3 estimateGas will failed because contract has enough affirmations.
    const info3 = await s3.EventToTxInfo(task)
    expect(info3).to.be.null
  })

  it('test three sender estimateGas race condition', async () => {
    const task = await utils.makeTransfer(accounts[0])
    await w3.miner.stop()

    const [s1, s2] = await utils.newSenders(w3, 2)
    const [q1, q2] = await utils.newQueues(2)

    // s1 and s1 vote first
    const info1 = await s1.EventToTxInfo(task)
    const info2 = await s2.EventToTxInfo(task)
    expect(info1.gasEstimate).to.eq(info2.gasEstimate)

    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    await utils.makeOneBlock(w3)
    expect(r1).to.eq('success')

    // v2 will be fail because gas limit too low.
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    expect(r2).to.eq('success')

    await utils.makeOneBlock(w3, expectFail=true)

    const s2Receipt = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(s2Receipt.status).to.be.false

    const newInfo2 = await s2.EventToTxInfo(task)
    const newR2 = await s2.sendTx(newInfo2, q2.sendToQueue)
    expect(newR2).to.eq('success')

    await utils.makeOneBlock(w3)

    const nweReceipt = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(nweReceipt.status).to.be.true
    expect(nweReceipt.gasUsed).to.gt(s2Receipt.gasUsed)
  })

  it('test three sender send in same block', async () => {
    const task = await utils.makeTransfer(accounts[0])
    await w3.miner.stop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [q1, q2, q3] = await utils.newQueues(3)

    const info1 = await s1.EventToTxInfo(task)
    const info2 = await s2.EventToTxInfo(task)
    const info3 = await s3.EventToTxInfo(task)

    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    const r3 = await s3.sendTx(info3, q3.sendToQueue)

    expect(r1).to.eq('success')
    expect(r2).to.eq('success')
    expect(r3).to.eq('success')

    await utils.makeOneBlock(w3, expectFail=true)

    const receipt1 = await utils.getReceiptFromSenderQueue(w3, q1.queue)
    const receipt2 = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    const receipt3 = await utils.getReceiptFromSenderQueue(w3, q3.queue)

    expect(receipt1.status).to.be.true
    expect(receipt2.status).to.be.false
    expect(receipt3.status).to.be.false
  })

  afterEach(async() =>{
    await w3.miner.start()
  })
})