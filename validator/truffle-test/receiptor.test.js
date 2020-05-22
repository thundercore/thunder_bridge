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

async function featureBlock(s=1) {
  const begin = await web3.eth.getBlockNumber()
  for (var i=0; i<s; i++) {
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
    return erc20.methods
      .transfer(foreign.options.address, web3.utils.toWei('0.01'))
      .send({ from: from })
  }

  it('test get receipt success', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const receipt = await makeTransfer()
    const nonce = 10
    const eventTask = {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
    const tx = {
      eventTask: eventTask,
      nonce: nonce,
      timestamp: Date.now(),
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }

    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.skipped)
    await featureBlock(10)
    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.skipped)
    await featureBlock(config.BLOCK_CONFIRMATION-10)
    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.success)
  })

  it('test get null receipt', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    const receipt = await makeTransfer()
    const nonce = 10
    const eventTask = {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
    // Make a fake txHash
    receipt.transactionHash = '0x1234567890123456789012345678901234567890123456789012345678901234'
    const tx = {
      eventTask: eventTask,
      nonce: nonce,
      timestamp: Date.now(),
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }

    await featureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.null)
  })

  it('test get reverted receipt', async () => {
    const snapshotId = await web3.miner.snapshot()

    const w = new receiptor.ReceiptorWeb3Impl(web3)
    const r = new receiptor.Receiptor(w)
    // Make a transfer and revert it immediately
    const receipt = await makeTransfer()
    await web3.miner.revert(snapshotId)

    const nonce = 10
    const eventTask = {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
    // Make a fake txHash
    receipt.transactionHash = '0x1234567890123456789012345678901234567890123456789012345678901234'
    const tx = {
      eventTask: eventTask,
      nonce: nonce,
      timestamp: Date.now(),
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }

    // Because the block of transfer tx was reverted.
    // Need to advence more one block for block confirmation checking
    await featureBlock(config.BLOCK_CONFIRMATION+1)
    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.null)
  })

  it('test get receipt timeout', async () => {
    const w = new receiptor.ReceiptorWeb3Impl(web3)
    let p = new Promise(resolve => setTimeout(resolve, 10000))
    w.getTransactionReceipt = stub().resolves(p)
    const r = new receiptor.Receiptor(w)
    const receipt = await makeTransfer()

    const nonce = 10
    const eventTask = {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
    // Make a fake txHash
    receipt.transactionHash = '0x1234567890123456789012345678901234567890123456789012345678901234'
    const tx = {
      eventTask: eventTask,
      nonce: nonce,
      timestamp: Date.now(),
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    }

    await featureBlock(config.BLOCK_CONFIRMATION)
    expect(await r.run(tx, sendToQueue)).to.eq(receiptor.ReceiptResult.timeout)
  })

  after(async() => {
    await web3.miner.start()
  })
})