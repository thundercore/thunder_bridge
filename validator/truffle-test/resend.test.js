const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const HomeBridge = artifacts.require('HomeBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const storage = require(path.join(__dirname, '../src/lib/storage'))
const locker = require(path.join(__dirname, '../src/lib/locker'))
const { expect } = require('chai')
const { createSandbox, stub } = require('sinon')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))
const utils = require('./utils')

const w3 = utils.newWeb3()

const foreign = new w3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
const home = new w3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address)
const erc20 = new w3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)

const sandbox = createSandbox()

const makeTransfer = async (account) => {
    return await utils.makeTransfer(w3, erc20, account, foreign.options.address)
}

contract('test resend task', (accounts) => {

  it('task resend with same nonce', async () => {
    const task = await makeTransfer(accounts[0])

    await w3.miner.stop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()

    // Send a transaction to occupy nonce
    const nonce = await s.readNonce()
    s.web3.sendToSelf(nonce)
    await utils.makeOneBlock(w3)

    // Send task with same nonce will raise nonce too low error
    task.nonce = nonce
    task.retries = 1
    let r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.nonceTooLow)
    await utils.makeOneBlock(w3)
  })

  it('task resend will fill nonce if task was skipped', async () => {
    const task = await makeTransfer(accounts[0])

    await w3.miner.stop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()
    const nonce = await s.readNonce(true)

    // returns null to trigger fill nonce.
    task.nonce = nonce
    task.retries = 100
    s.EventToTxInfo = stub().resolves(null)
    let r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.skipped)
    await utils.makeOneBlock(w3)

    // Expect nonce was updated
    const newNonce = await s.readNonce(true)
    expect(newNonce).to.gt(nonce)

    const txHash = q.queue.pop().transactionHash
    const receipt = await w3.eth.getTransactionReceipt(txHash)
    expect(receipt.status).to.be.true
    // AB transaction will not have logs
    expect(receipt.logs).to.have.length(0)
  })

  it('task resend with higher gas price', async () => {
    // FIXME: test with timestamp
    const task = await makeTransfer(accounts[0])

    await w3.miner.stop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()
    const nonce = await s.readNonce(true)

    // Mock gasPrice service to check if resend get a different gas price
    const getPrice = sandbox.stub(s.web3.gasPriceService, 'getPrice')
    const firstPrice = 12345678
    const secondPrice = 23456789
    getPrice.onCall(0).resolves(firstPrice)
    getPrice.onCall(1).resolves(secondPrice)

    const snapshotId = await w3.miner.snapshot()

    let r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)

    await utils.makeOneBlock(w3)

    tx = q.queue.pop().transactionHash
    const oldReceipt = await w3.eth.getTransactionReceipt(tx)
    const oldTx = await w3.eth.getTransaction(tx)
    expect(oldReceipt.status).to.be.true
    expect(Number(oldTx.gasPrice)).to.eq(firstPrice)

    await w3.miner.revert(snapshotId)

    task.nonce = nonce
    task.retries = 100
    r = await s.run(task, q.sendToQueue)
    expect(r).to.be.eq(sender.SendResult.success)

    await utils.makeOneBlock(w3)

    tx = q.queue.pop().transactionHash
    const newReceipt = await w3.eth.getTransactionReceipt(tx)
    const newTx = await w3.eth.getTransaction(tx)
    expect(newReceipt.status).to.be.true
    expect(Number(newTx.gasPrice)).to.eq(secondPrice)
  })

  // ganache will raise `the tx doesn't have the correct nonce`
  // error if tx has wrong nonce.
  it.skip('task resend task out of order', async () => {
    const tA = await makeTransfer(accounts[0])
    const tB = await makeTransfer(accounts[0])
    const tC = await makeTransfer(accounts[0])
    const tD = await makeTransfer(accounts[0])

    await w3.miner.stop()
    const [s] = await utils.newSenders(w3, 1)
    const q = await utils.newQueue()
    const nonce = await s.readNonce(true)

    tA.nonce = nonce
    tB.nonce = nonce+1
    tC.nonce = nonce+2
    tD.nonce = nonce+3
    tA.retries = tB.retries = tC.retries = tD.retries = 100

    const rc = await s.run(tC, q.sendToQueue)
    await utils.makeOneBlock(w3)
    const rb = await s.run(tB, q.sendToQueue)
    await utils.makeOneBlock(w3)
    const rd = await s.run(tD, q.sendToQueue)
    await utils.makeOneBlock(w3)
    const ra = await s.run(tA, q.sendToQueue)
    await utils.makeOneBlock(w3)

    expect(q.queue).to.have.length(4)
    [ra, rb, rc, rd].forEach(r => {
      expect(r).to.be.eq(success)
    });

    q.queue.forEach(async(r) => {
      const receipt = await w3.eth.getTransactionReceipt(r.transactionHash)
      expect(receipt.status).to.be.true
    })
  })

  afterEach(async() =>{
    await w3.miner.start()
    sandbox.restore()
  })
})