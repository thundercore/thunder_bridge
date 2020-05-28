const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const receiptor = require(path.join(__dirname, '../src/lib/receiptor'))
const locker = require(path.join(__dirname, '../src/lib/locker'))
const Web3 = require('web3')

const { expect } = require('chai')

const gasPriceService = {
  getPrice: async (timestamp) => {
    return await web3.eth.getGasPrice()
  }
}

async function makeOneBlock() {
  const begin = await web3.eth.getBlockNumber()
  await web3.miner.mine(Date.now())
  const end = await web3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}

async function futureBlock(n=1) {
  const begin = await web3.eth.getBlockNumber()
  for (var i=0; i<n; i++) {
    await web3.miner.mine(Date.now() + Number(i)*1000)
  }
  const end = await web3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}

function newWeb3() {
  const w3 = new Web3(web3.currentProvider)

  w3.extend({
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

  return w3
}

async function newQueue() {
  let queue = []
  return {
    queue,
    sendToQueue: (item) => {
      queue.push(item)
    }
  }
}

async function getReceiptFromSenderQueue(w3, queue) {
    const txHash = queue.pop().transactionHash
    expect(txHash).to.be.not.undefined
    return await w3.eth.getTransactionReceipt(txHash)
}

async function newSender(w3, id, validator) {
  const chainId = await w3.eth.net.getId()
  const w = new sender.SenderWeb3Impl(id, chainId, validator, w3, gasPriceService)
  const l = new locker.FakeLocker()

  return new sender.Sender(id, w, l, null)
}

async function newReceiptor(w3, id) {
  const w = new receiptor.ReceiptorWeb3Impl(w3)
  return new receiptor.Receiptor(id, w)
}

async function makeOneBlock(w3, exceptFail=false) {
  const begin = await w3.eth.getBlockNumber()

  let err;
  try {
    await w3.miner.mine(Date.now())
  } catch(e) {
    if (!exceptFail) {
      throw e
    }
    err = e
  }

  if (exceptFail) {
    expect(err).to.be.not.null
  }

  const end = await w3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}

module.exports = {
  getReceiptFromSenderQueue,
  gasPriceService,
  makeOneBlock,
  newQueue,
  newSender,
  newReceiptor,
  newWeb3
}