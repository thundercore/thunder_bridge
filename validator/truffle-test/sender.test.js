const { BRIDGE_MODE } = process.env

const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const storage = require(path.join(__dirname, '../src/lib/storage'))
const { expect } = require('chai')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))
const utils = require('./utils')

const w3 = utils.newWeb3()

let foreign, erc20
if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  const ForeignBridge = artifacts.require('ForeignBridgeWithNativeToken')
  erc20 = foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
} else {
  const ForeignBridge = artifacts.require('ForeignBridgeErcToErcV2')
  const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
  foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
  erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)
}

// In home bridge v2, we changed reduce the gas. Set extra price percentage to 0 for race condition case.
process.env.EXTRA_GAS_PERCENTAGE = 0

const makeTransfer = async (account) => {
  return utils.makeTransfer(w3, erc20, account, foreign.options.address)
}

contract("Test single sender", (accounts) => {

  let q = []
  let chainOpW3 = null
  beforeEach(async () => {
    q = await utils.newQueue()
    chainOpW3 = await utils.ChainOpWeb3(w3)
  })

  it('test transfer success', async () => {
    const task = await makeTransfer(accounts[9])

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
    expect(receiptTask.sentBlock).to.gte(currentBlock)
    expect(receiptTask.transactionHash).to.have.length(66)
    await chainOpW3.makeOneBlock(accounts[8])

    // Send task second time with skipped result
    ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq('skipped')
    expect(q.queue).to.have.length(0)
  })

  it('test transfer with lower nonce will be failed', async () => {
    const task = await makeTransfer(accounts[9])

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

  it("test tx was imported", async function() {
    // FIXME: truffle will return `the tx doesn't have the correct nonce` message.
    // It's different from geth. We skiped this test before we found a better way to test this case.
    // Only run this test on pala
    const id = await w3.eth.net.getId()
    if (id !== 19) {
      this.skip()
    }
    const task1 = await makeTransfer(accounts[9])
    const task2 = await makeTransfer(accounts[9])

    const [s] = await utils.newSenders(w3, 1)
    const info1 = await s.processEventTask(task1)
    const info2 = await s.processEventTask(task2)

    const nonce = await s.readNonce(true)
    info1.eventTask.nonce = nonce
    info1.eventTask.retries = 1
    info2.eventTask.nonce = nonce + 1
    info2.eventTask.retries = 1

    const r1 = await s.sendTx(info2, q.sendToQueue)
    const r2 = await s.sendTx(info2, q.sendToQueue)
    await chainOpW3.makeOneBlock(accounts[8])

    expect(r1).to.be.eq("success")
    expect(r2).to.be.eq(sender.SendResult.txImported)
    expect(q.queue).to.have.length(2)
    await s.sendTx(info1, q.sendToQueue)
  })

  it('test gas limit exceeded', async () => {
    // TODO: maybe run another chain?
    const task = await makeTransfer(accounts[9])
    const [s] = await utils.newSenders(w3, 1)
    const info = await s.processEventTask(task)
    info.gasEstimate = 100000000000000

    const ret = await s.sendTx(info, q.sendToQueue)
    expect(ret).to.eq(sender.SendResult.blockGasLimitExceeded)
    expect(q.queue).to.have.length(0)
  })

  it('test transfer with same nonce will be fail', async () => {
    const task = await makeTransfer(accounts[9])

    const [s] = await utils.newSenders(w3, 1)
    const c = s.cache
    // Fix nonce to same value
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, nonce)

    // First task will be success
    let ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq('success')

    // Second task with same nonce will be fail.
    const newtask = await makeTransfer(accounts[9])
    await c.set(s.nonceKey, nonce)
    ret = await s.run(newtask, q.sendToQueue)
    expect(ret).to.eq(sender.SendResult.nonceTooLow)
    expect(await c.get(s.nonceKey)).to.eq((nonce + 1).toString())
    // Task is not `acked` in queue

    expect(q.queue).to.have.length(1)
  })

  it('test insufficient fund', async () => {
    const task = await makeTransfer(accounts[9])
    const [s] = await utils.newSenders(w3, 1)
    s.web3.getPrice = async (ts) => {
      return await w3.eth.getBalance(accounts[0])
    }
    const ret = await s.run(task, q.sendToQueue)
    expect(ret).to.eq(sender.SendResult.insufficientFunds)
  })
})

contract('Test multiple senders', (accounts) => {
  let chainOpW3 = null
  beforeEach(async () => {
    chainOpW3 = await utils.ChainOpWeb3(w3)
  })

  it('test third sender estimateGas will failed', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [q1, q2] = await utils.newQueues(2)

    // s1 and s2 vote first
    // processEventTask will run estimateGas.
    const info1 = await s1.processEventTask(task)
    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    expect(r1).to.eq('success')
    await chainOpW3.makeOneBlock(accounts[8])
    const receipt1 = await utils.getReceiptFromSenderQueue(w3, q1.queue)
    expect(receipt1.status).to.be.true

    const info2 = await s2.processEventTask(task)
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    expect(r2).to.eq('success')
    await chainOpW3.makeOneBlock(accounts[8])

    // We expect gasR2 > gasR1 due to enough affirmations.
    expect(info2.gasEstimate).to.gt(info1.gasEstimate)

    const receipt2 = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(receipt2.gasUsed).to.gt(receipt1.gasUsed)
    expect(receipt2.status).to.be.true

    // v3 estimateGas will failed because contract has enough affirmations.
    const info3 = await s3.processEventTask(task)
    expect(info3).to.be.null
  })

  it('test three sender estimateGas race condition', async () => {
    const task = await makeTransfer(accounts[9])
    await chainOpW3.minerStop()

    const [s1, s2] = await utils.newSenders(w3, 2)
    const [q1, q2] = await utils.newQueues(2)

    // s1, s2 estimate gas at same time
    const info1 = await s1.processEventTask(task)
    const info2 = await s2.processEventTask(task)
    expect(info1.gasEstimate).to.eq(info2.gasEstimate)

    // s1 vote first
    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    await chainOpW3.makeOneBlock(accounts[8])
    expect(r1).to.eq('success')

    // v2 will be fail because gas limit too low.
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    expect(r2).to.eq('success')

    await chainOpW3.makeOneBlock(accounts[8], true)

    const s2Receipt = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(s2Receipt.status).to.be.false

    const newInfo2 = await s2.processEventTask(task)
    const newR2 = await s2.sendTx(newInfo2, q2.sendToQueue)
    expect(newR2).to.eq('success')

    await chainOpW3.makeOneBlock(accounts[8])

    const nweReceipt = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    expect(nweReceipt.status).to.be.true
    expect(nweReceipt.gasUsed).to.gt(s2Receipt.gasUsed)
  })

  it('test three sender send in same block', async () => {
    const task = await makeTransfer(accounts[9])
    await chainOpW3.minerStop()

    const [s1, s2, s3] = await utils.newSenders(w3, 3)
    const [q1, q2, q3] = await utils.newQueues(3)

    const info1 = await s1.processEventTask(task)
    const info2 = await s2.processEventTask(task)
    const info3 = await s3.processEventTask(task)

    const r1 = await s1.sendTx(info1, q1.sendToQueue)
    const r2 = await s2.sendTx(info2, q2.sendToQueue)
    const r3 = await s3.sendTx(info3, q3.sendToQueue)

    expect(r1).to.eq('success')
    expect(r2).to.eq('success')
    expect(r3).to.eq('success')

    await chainOpW3.makeOneBlock(accounts[8], true)

    const receipt1 = await utils.getReceiptFromSenderQueue(w3, q1.queue)
    const receipt2 = await utils.getReceiptFromSenderQueue(w3, q2.queue)
    const receipt3 = await utils.getReceiptFromSenderQueue(w3, q3.queue)

    expect(receipt1.status).to.be.true
    expect(receipt2.status).to.be.false
    expect(receipt3.status).to.be.false
  })

  afterEach(async () => {
    await chainOpW3.minerStart()
  })
})
