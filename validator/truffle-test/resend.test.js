const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const { expect } = require('chai')
const { createSandbox, stub } = require('sinon')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))
const utils = require('./utils')

const w3 = utils.newWeb3()

const foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
const erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)

const sandbox = createSandbox()

const makeTransfer = async (account) => {
  return await utils.makeTransfer(w3, erc20, account, foreign.options.address)
}

contract('test resend task', (accounts) => {
  const dummy = accounts[8]

  let chainOpW3 = null
  beforeEach(async () => {
    chainOpW3 = await utils.ChainOpWeb3(w3)
  })

  it('test resend task (task.nonce == currNonce)', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    const nonce = await s.readNonce()
    task.nonce = nonce
    task.retries = 1

    // Update nonce to emulate there are many tasks have sent before this resend task
    await s.updateNonce(nonce+10)

    // Because this nonce was not occupied, sender will use this nonce to send tx.
    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)
    expect(q.queue.pop().nonce).to.be.eq(nonce)
    await chainOpW3.makeOneBlock(dummy)
  })

  it('test resend task with an occupied nonce (task.nonce < currNonce)', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // Send a transaction to occupy nonce
    const nonce = await s.readNonce()
    // currNonce++
    s.web3.sendToSelf(nonce)
    await chainOpW3.makeOneBlock(dummy)

    // currNonce = nonce+1, taskNonce = nocne, taskNone < currNonce
    task.nonce = nonce
    task.retries = 1
    // Because this nonce was occupied, sender will use nonce+1 to send tx.
    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)
    expect(q.queue.pop().nonce).to.be.eq(nonce+1)
    await chainOpW3.makeOneBlock(dummy)
  })

  it('test resend task (task.nonce > currNonce)', async function() {
    // ganache will raise `the tx doesn't have the correct nonce`
    // error if tx has wrong nonce. only run this test when testing on pala
    const id = await w3.eth.net.getId()
    if (id !== 19) {
      this.skip()
    }

    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    const nonce = await s.readNonce()
    const snapshotId = await chainOpW3.snapshot()

    // nonce++
    await s.web3.sendToSelf(nonce)
    await chainOpW3.makeOneBlock(dummy)

    // currNonce = taskNone = nonce+1
    const taskNone = await s.readNonce()
    task.nonce = taskNone
    task.retries = 1

    // currNonce = nonce, taskNone = nonce+1, taskNonce > currNonce
    await chainOpW3.revert(snapshotId)

    // taskNonce > currNonce, sender use taskNonce to send tx
    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)
    expect(q.queue.pop().nonce).to.be.eq(taskNone)
    await chainOpW3.makeOneBlock(dummy)
  })

  it('test resend task was skipped with an occupied nonce', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // Send a transaction to occupy nonce
    const nonce = await s.readNonce()
    s.web3.sendToSelf(nonce)
    await chainOpW3.makeOneBlock(dummy)

    sandbox.stub(s, 'processEventTask').resolves(null)
    task.nonce = nonce
    task.retries = 1
    // Because processEventTask skip this event and nonce was occupied,
    // we don't need to fill this nonce.
    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.skipped)
    await chainOpW3.makeOneBlock(dummy)
  })

  it('test resend task fill nonce with nonce too low', async () => {
    // 1. v2, v3 vote with success
    // 2. v1 resend but old tx still in txpool
    // 3. v1 estimateGas returns null and v1.nonce > currNonce (due to 2), so v1 run sendToSelf
    // before v1 actually submit tx, old tx is packed and cause currNonce >= v1.nonce
    // This will raise nonce too low error while send to self.

    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // returns null to trigger fill nonce.
    const nonce = await s.readNonce(true)
    task.nonce = nonce
    task.retries = 100
    s.processEventTask = stub().resolves(null)
    const _sendToSelf = s.sendToSelf
    s.sendToSelf = async (...args) => {
      // nonce++ in selfToSelf
      await _sendToSelf.apply(s, args)
      await chainOpW3.makeOneBlock(dummy)

      return await _sendToSelf.apply(s, args)
    }

    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.skipped)
    await chainOpW3.makeOneBlock(dummy)
  })
  it.only('test resend task fill nonce with tx was imported', async function() {
    // 1. v2, v3 vote with success
    // 2. v1 old tx was dropped due to fullnode problem.
    // 3. v1 will sendToSelf but queue in txpool but cannot be packed to due some reason (ex: price too low)
    // 4. receiptor re-enqueue task and sender run sendToSelf again.
    // 5. sendToSelf returns tx was imported.

    const id = await w3.eth.net.getId()
    if (id !== 19) {
      this.skip()
    }

    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // returns null to trigger fill nonce.
    const nonce = await s.readNonce(true)
    task.nonce = nonce
    task.retries = 100
    s.processEventTask = stub().resolves(null)

    const r1 = await s.run(task, q.sendToQueue)
    const tx1 = q.queue.pop().transactionHash
    const r2 = await s.run(task, q.sendToQueue)
    const tx2 = q.queue.pop().transactionHash
    expect(r1).to.be.eq(sender.SendResult.sendDummyTxToFillNonce)
    expect(r2).to.be.eq(sender.SendResult.sendDummyTxToFillNonce)
    expect(tx1).to.be.eq(tx2)
    await chainOpW3.makeOneBlock(dummy)
  })

  it('test resend will fill nonce if task was skipped', async () => {
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // returns null to trigger fill nonce.
    const nonce = await s.readNonce(true)
    task.nonce = nonce
    task.retries = 100
    s.processEventTask = stub().resolves(null)
    const r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.sendDummyTxToFillNonce)
    await chainOpW3.makeOneBlock(dummy)

    // Expect nonce was updated
    const newNonce = await s.readNonce(true)
    expect(newNonce).to.gt(nonce)

    const txHash = q.queue.pop().transactionHash
    const receipt = await w3.eth.getTransactionReceipt(txHash)
    expect(receipt.status).to.be.true
    // AB transaction will not have logs
    expect(receipt.logs).to.have.length(0)
  })

  it('test resend with higher gas price', async () => {
    // FIXME: test with timestamp
    const task = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()
    const nonce = await s.readNonce(true)

    // Mock gasPrice service to check if resend get a different gas price
    const getPrice = sandbox.stub(s.web3.gasPriceService, 'getPrice')
    const firstPrice = 12345678
    const secondPrice = 23456789
    getPrice.onCall(0).resolves(firstPrice)
    getPrice.onCall(1).resolves(secondPrice)

    const snapshotId = await chainOpW3.snapshot()

    let r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)

    await chainOpW3.makeOneBlock(dummy)

    tx = q.queue.pop().transactionHash
    const oldReceipt = await w3.eth.getTransactionReceipt(tx)
    const oldTx = await w3.eth.getTransaction(tx)
    expect(oldReceipt.status).to.be.true
    expect(Number(oldTx.gasPrice)).to.eq(firstPrice)

    await chainOpW3.revert(snapshotId)

    task.nonce = nonce
    task.retries = 100
    r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)

    await chainOpW3.makeOneBlock(dummy)

    tx = q.queue.pop().transactionHash
    const newReceipt = await w3.eth.getTransactionReceipt(tx)
    const newTx = await w3.eth.getTransaction(tx)
    expect(newReceipt.status).to.be.true
    expect(Number(newTx.gasPrice)).to.eq(secondPrice)
  })

  // ganache will raise `the tx doesn't have the correct nonce`
  // error if tx has wrong nonce.
  it('test resend task out of order', async function () {
    // only run this test when testing on pala
    const id = await w3.eth.net.getId()
    if (id !== 19) {
      this.skip()
    }
    const tA = await makeTransfer(accounts[9])
    const tB = await makeTransfer(accounts[9])
    const tC = await makeTransfer(accounts[9])
    const tD = await makeTransfer(accounts[9])

    await chainOpW3.minerStop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()
    const nonce = await s.readNonce(true)

    tA.nonce = nonce
    tB.nonce = nonce + 1
    tC.nonce = nonce + 2
    tD.nonce = nonce + 3
    tA.retries = tB.retries = tC.retries = tD.retries = 100

    const rc = await s.run(tC, q.sendToQueue)
    await chainOpW3.makeOneBlock(dummy)
    const rb = await s.run(tB, q.sendToQueue)
    await chainOpW3.makeOneBlock(dummy)
    const rd = await s.run(tD, q.sendToQueue)
    await chainOpW3.makeOneBlock(dummy)
    const ra = await s.run(tA, q.sendToQueue)
    await chainOpW3.makeOneBlock(dummy)

    expect(q.queue).to.have.lengthOf(4)

    const results = [ra, rb, rc, rd]
    results.forEach((r) => {
      expect(r).to.equal('success')
    })

    q.queue.forEach(async (r) => {
      const receipt = await w3.eth.getTransactionReceipt(r.transactionHash)
      expect(receipt.status).to.be.true
    })
  })

  afterEach(async () => {
    await chainOpW3.minerStart()
    sandbox.restore()
  })
})
