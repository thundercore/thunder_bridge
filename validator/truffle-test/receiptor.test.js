const path = require('path')

const config = require(path.join(__dirname, '../config'))
const receiptor = require(path.join(__dirname, '../src/lib/receiptor'))
const { expect } = require('chai')
const { stub } = require('sinon')
const utils = require('./utils')

const w3 = utils.newWeb3()

contract('Test Receiptor', async (accounts) => {
  let chainOpW3 = null
  beforeEach(async () => {
    chainOpW3 = await utils.ChainOpWeb3(w3)
  })

  async function makeTransfer(from=accounts[0]) {
    const nonce = await w3.eth.getTransactionCount(from)
    return new Promise((resolve, _) => {
      const sendTx = w3.eth.sendTransaction({from:from, to:accounts[1], value:w3.utils.toWei('0.01'), nonce})
      sendTx.on('transactionHash', (hash)=> {
        resolve(hash)
      })
    })
  }

  async function getCurrentBlock() {
    return w3.eth.getBlockNumber()
  }

  async function makeReceiptTask(nonce=10) {
    const txHash = await makeTransfer()
    const eventTask = {
      eventType: 'erc-erc-affirmation-request',
      event: {},
    }
    return {
      eventTask: eventTask,
      nonce: nonce,
      timestamp: Date.now(),
      transactionHash: txHash,
      sentBlock: await getCurrentBlock()
    }
  }

  it('test get receipt success', async () => {
    await chainOpW3.minerStop()

    const [r] = await utils.newReceiptors(w3, 1)
    const task = await makeReceiptTask()
    const q = await utils.newQueue()

    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await chainOpW3.futureBlock(1)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingK)
    await chainOpW3.futureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.success)

    await chainOpW3.minerStart()
  })

  it('test get null receipt', async () => {
    const [r] = await utils.newReceiptors(w3, 1)
    const task = await makeReceiptTask()
    const q = await utils.newQueue()
    task.transactionHash= '0x1234567890123456789012345678901234567890123456789012345678901234'

    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await chainOpW3.futureBlock(1)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await chainOpW3.futureBlock(config.MAX_WAIT_RECEIPT_BLOCK)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.null)

    // Test queue items
    const resent = q.queue.pop()
    expect(resent.evnet).to.be.deep.eq(task.event)
    expect(resent.nonce).to.eq(task.nonce)
    expect(resent.retries).to.eq(1)
  })

  it('test get reverted receipt', async () => {
    const snapshotId = await chainOpW3.snapshot()

    const [r] = await utils.newReceiptors(w3, 1)
    const task = await makeReceiptTask()
    const q = await utils.newQueue()

    await chainOpW3.revert(snapshotId)

    // Because the block of transfer task was reverted.
    // Need to advence more one block for confirmation checking
    await chainOpW3.futureBlock(config.MAX_WAIT_RECEIPT_BLOCK+1)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.null)

    // Test queue items
    const resent = q.queue.pop()
    expect(resent.evnet).to.be.deep.eq(task.event)
    expect(resent.nonce).to.eq(task.nonce)
    expect(resent.retries).to.eq(1)
  })

  // FIXME: use fake timer
  it('test get receipt timeout', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(w3)
    let p = new Promise(resolve => setTimeout(resolve, 10000))
    w.getTransactionReceipt = stub().resolves(p)
    const r = new receiptor.Receiptor('r1', w)
    const q = await utils.newQueue()

    const task = await makeReceiptTask()
    await chainOpW3.futureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.timeout)
  })

  it('test get receipt with chain forked', async () => {
    await chainOpW3.minerStop()
    const snapshotId = await chainOpW3.snapshot()

    const [r] = await utils.newReceiptors(w3, 1)
    const task = await makeReceiptTask()
    const q = await utils.newQueue()

    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await chainOpW3.futureBlock(1)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingK)
    await chainOpW3.revert(snapshotId)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await chainOpW3.futureBlock(config.MAX_WAIT_RECEIPT_BLOCK)
    expect(await r.run(task, q.sendToQueue)).to.eq(receiptor.ReceiptResult.null)

  })

  afterEach(async () => {
    await chainOpW3.minerStart()
  })
})
