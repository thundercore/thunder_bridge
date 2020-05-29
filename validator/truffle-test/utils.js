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

async function futureBlock(w3, n=1) {
  const begin = await web3.eth.getBlockNumber()
  for (var i=0; i<n; i++) {
    await w3.miner.mine(Date.now() + Number(i)*1000)
  }
  const end = await w3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}

async function makeTransfer(account) {
  const receipt = await erc20.methods
    .transfer(foreign.options.address, w3.utils.toWei('0.01'))
    .send({ from: account })
  return {
    eventType: 'erc-erc-affirmation-request',
    event: receipt.events.Transfer,
  }
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

// This accounts are generated by mnemonic:
// 'wisdom zero output drift choice bright east stuff craft inform invest patient'
const Accounts = [
  v1 = {
    address: '0x0b663c33A72819d2371Ad7939A4C29dc31C0881b',
    privateKey: '4bf3b1bb36eb3f53d1ae5e6309510e17fe41df9a26a236de3385872211e0eab4',
  },
  v2 = {
    address: '0x99FACa9358aeA27eeD49b4DE150757c89F8c2a0D',
    privateKey: '62911097680a3251a49e89d7b6f200b909acb13f8aba98ec4a0a77a71ab4f4e6',
  },
  v3 = {
    address: '0x3B128139756e78e16a3DeaDEeE0c529Bf182a90A',
    privateKey: '7469990333fa18a8fed66b945970b3af09de3d6a5863535cf102b3938a7ff41a',
  }
]

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

async function newSenders(w3, number=3) {
  let senders = []
  for (let i=0; i<number; i++) {
    senders.push(await newSender(w3, `v${i}`, Accounts[i]))
  }
  return senders
}

async function newQueues(number=3) {
  let queues = []
  for (let i=0; i<number; i++) {
    queues.push(await newQueue())
  }
  return queues
}

async function newReceiptors(w3, number=3) {
  let rs = []
  for (let i=0; i<number; i++) {
    rs.push(await newReceiptor(w3, `r${i}`))
  }
  return rs
}

module.exports = {
  getReceiptFromSenderQueue,
  gasPriceService,
  makeOneBlock,
  futureBlock,
  newQueue,
  newQueues,
  newSender,
  newSenders,
  newReceiptor,
  newReceiptors,
  newWeb3,
  makeTransfer,
  Accounts
}