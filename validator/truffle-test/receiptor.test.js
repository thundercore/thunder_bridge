const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const HomeBridge = artifacts.require('HomeBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const config = require(path.join(__dirname, '../config'))
const receiptor = require(path.join(__dirname, '../src/lib/receiptor'))
const { expect } = require('chai')
const { stub } = require('sinon')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))

web3.extend({
  property: 'miner',
  methods: [
    {
      name: 'start',
      call: 'miner_start'
    }, {
      name: 'stop',
      call: 'miner_stop'
    }, {
      name: 'snapshot',
      call: 'evm_snapshot',
    }, {
      name: 'revert',
      call: 'evm_revert',
      params: 1
    }, {
      name: 'mine',
      call: 'evm_mine',
      params: 1
    }
  ]
});

async function futureBlock(n=1) {
  const begin = await web3.eth.getBlockNumber()
  for (var i=0; i<n; i++) {
    await web3.miner.mine(Date.now() + Number(i)*1000)
  }
  const end = await web3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}


async function sendToQueue(task) {
  console.log(`${task} was enqueued`)
}


contract("Test Receiptor", async (accounts) => {
  const foreign = new web3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address);
  const home = new web3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address);
  const erc20 = new web3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address);

  const v1 = {
    address: accounts[1],
    privateKey: '4bf3b1bb36eb3f53d1ae5e6309510e17fe41df9a26a236de3385872211e0eab4',
  }

  async function makeTransfer(from=accounts[0]) {
    return new Promise((resolve, reject) => {
      const sendTx = web3.eth.sendTransaction({from:from, to:accounts[1], value:web3.utils.toWei('0.01')})
      sendTx.on('transactionHash', (hash)=> {
        resolve(hash)
      })
    })
  }

  async function getCurrentBlock() {
    return web3.eth.getBlockNumber()
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
    await web3.miner.stop()
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const task = await makeReceiptTask()

    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await futureBlock(1)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingK)
    await futureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.success)

    await web3.miner.start()
  })

  it('test get null receipt', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const task = await makeReceiptTask()
    task.transactionHash= '0x1234567890123456789012345678901234567890123456789012345678901234'

    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await futureBlock(1)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await futureBlock(config.MAX_WAIT_RECEIPT_BLOCK)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.null)
  })

  it('test get reverted receipt', async () => {
    const snapshotId = await web3.miner.snapshot()

    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const task = await makeReceiptTask()
    await web3.miner.revert(snapshotId)

    // Because the block of transfer task was reverted.
    // Need to advence more one block for block confirmation checking
    await futureBlock(config.MAX_WAIT_RECEIPT_BLOCK+1)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.null)
  })

  it('test get receipt timeout', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    let p = new Promise(resolve => setTimeout(resolve, 10000))
    w.getTransactionReceipt = stub().resolves(p)
    const r = new receiptor.Receiptor(w)
    const task = await makeReceiptTask()

    await futureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.timeout)
  })

  it('test get receipt with chain forked', async () => {
    await web3.miner.stop()
    const snapshotId = await web3.miner.snapshot()

    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const task = await makeReceiptTask()

    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await futureBlock(1)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingK)
    await web3.miner.revert(snapshotId)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.waittingReceipt)
    await futureBlock(config.MAX_WAIT_RECEIPT_BLOCK)
    expect(await r.run(task, sendToQueue)).to.eq(receiptor.ReceiptResult.null)

  })

  afterEach(async () => {
    await web3.miner.start()
  })
})