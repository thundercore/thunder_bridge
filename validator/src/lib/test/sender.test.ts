import Web3 from 'web3'
import { expect } from 'chai'
import { createSandbox, stub } from 'sinon'
import { TransactionConfig, TransactionReceipt } from 'web3-core'
import { toBN, toWei } from 'web3-utils'
import { BigNumber } from 'bignumber.js'

import { FakeCache } from '../storage'
import { FakeLocker } from '../locker'
import { Sender, SenderWeb3Impl, Validator, SendResult } from '../sender'
import { TxInfo, ReceiptTask, EventTask } from '../types'
import { addExtraGas } from '../../utils/utils'
import { EventEmitter } from 'events'
import sinon from 'sinon'

const EXTRA_GAS_PERCENTAGE = 1

const sandbox = createSandbox()
const fakeEvent: EventTask = {
  eventType: 'fake-event-type',
  event: {
    returnValues: {
      fromBlock: 10,
      toBlock: 20,
    },
    raw: {
      data: '',
      topics: [],
    },
    event: 'fake-event',
    signature: '',
    logIndex: 0,
    transactionIndex: 10,
    transactionHash: '',
    blockHash: '',
    blockNumber: 20,
    address: '',
  },
}

const transactionHash = '0xb909b8f4074f45f067125348eb1cf71a197149dc03a37446dacd4a925963ff47'

const sendToQueue = (task: ReceiptTask): Promise<void> => {
  return Promise.resolve()
}

describe('Test SenderWeb3Impl', () => {
  const validator: Validator = {
    address: '0x458b8adf2248709cf739149fe4bab0b20101c4a1',
    privateKey: '348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
  }

  it('test send tx', async () => {
    const nonce = 10
    const gasLimit = new BigNumber(100)
    const amount = toBN('10')
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: toBN(50),
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    const gasService = {
      getPrice: (timestamp: number) => Promise.resolve(10),
    }

    const web3 = new Web3(null)
    const chainId = 100
    const sw = new SenderWeb3Impl('myid', chainId, validator, web3, gasService)

    const privateKey = '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709'

    const signTransaction = sandbox.stub().resolves({
      messageHash: '0x88cfbd7e51c7a40540b233cf68b62ad1df3e92462f1c6018d6d67eae0f3b08f5',
      v: '0x25',
      r: '0xc9cf86333bcb065d140032ecaab5d9281bde80f21b9687b3e94161de42d51895',
      s: '0x727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68',
      rawTransaction:
        '0xf869808504e3b29200831e848094f0109fc8df283027b6285cc889f' +
        '5aa624eac1f55843b9aca008025a0c9cf86333bcb065d140032ecaab5d9281bde80f21b9687' +
        'b3e94161de42d51895a0727a108a0b8d101465414033c3f705a9c7b826e596766046ee1183dbc8aeaa68',
    })
    web3.eth.accounts.signTransaction = signTransaction

    const spy = sinon.spy()
    const emitter = new EventEmitter()
    emitter.on('transactionHash', spy)

    web3.eth.sendSignedTransaction = sandbox.stub().returns(spy)

    const p = sw.sendTransaction(nonce, gasLimit, amount, txinfo)
    const txHash = await p

    // Test signTransaction arguments
    const expectTxConfig: TransactionConfig = {
      nonce,
      chainId,
      to: txinfo.to,
      data: txinfo.data,
      value: toWei(amount),
      gas: gasLimit.toString(),
      gasPrice: (await gasService.getPrice(Math.floor(Date.now() / 1000))).toString(),
    }
    expect(signTransaction.lastCall.args[0]).to.be.deep.equal(expectTxConfig)
    expect(signTransaction.lastCall.args[1]).to.be.deep.equal(privateKey)
    expect(txHash).to.be.equal(transactionHash)
  })
})

describe('Test Sender', () => {
  let web3: Web3
  let sw: SenderWeb3Impl
  let cache: FakeCache
  let lock: FakeLocker
  let sender: Sender

  const validator: Validator = {
    address: '0x458b8adf2248709cf739149fe4bab0b20101c4a1',
    privateKey: '348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
  }

  beforeEach(() => {
    web3 = new Web3(null)
    sw = new SenderWeb3Impl('myid', 100, validator, web3, null)
    cache = new FakeCache()
    lock = new FakeLocker()
    sender = new Sender("myid", sw, lock, cache)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('Test nonce', async () => {
    web3.eth.getTransactionCount = sandbox.stub().resolves(20)
    // Cache miss
    expect(await sender.readNonce(false)).to.be.equal(20)

    // Cache hit
    await cache.set(sender.nonceKey, '10')
    expect(await sender.readNonce(false)).to.be.equal(10)
    expect(await cache.get(sender.nonceKey)).to.be.equal('10')

    // Force update
    web3.eth.getTransactionCount = sandbox.stub().resolves(50)
    expect(await sender.readNonce(true)).to.be.equal(50)

    await sender.updateNonce(20)
    expect(await cache.get(sender.nonceKey)).to.be.equal('20')
  })

  it('Test sendTx success', async () => {
    const gasUnit = toBN(10)
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    const nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    const s = sandbox.stub().resolves(transactionHash)
    sw.sendTransaction = s
    sw.getCurrentBlock = sandbox.stub().resolves(100)

    const result = await sender.sendTx(txinfo, sendToQueue)

    expect(s.lastCall.args[0]).to.be.equal(nonce)
    // Expect call args: gasEstimate = txinfo.gasEstimate * EXTRA_GAS_PERCENTAGE
    const expectedGas = addExtraGas(gasUnit, EXTRA_GAS_PERCENTAGE)
    expect(s.lastCall.args[1]).to.be.deep.equal(expectedGas)
    expect(s.lastCall.args[2]).to.be.deep.equal(toBN('0'))
    expect(s.lastCall.args[3]).to.be.deep.equal(txinfo)

    // Result success
    expect(result).eq('success')
    // Nonce++
    expect(await cache.get(sender.nonceKey)).eq('51')
  })

  it('Test sendTx with tx already imported', async () => {
    const gasUnit = toBN(10)
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    const nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    sw.sendTransaction = sandbox.stub().throws(Error('Transaction with the same hash was already imported'))

    let result = await sender.sendTx(txinfo, sendToQueue)
    expect(result).eq(SendResult.txImported)

    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq('50')
  })

  it('Test sendTx with low nonce', async () => {
    const gasUnit = toBN(10)
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    // chain nonce: 100 > cached nonce 50
    await cache.set(sender.nonceKey, '50')
    web3.eth.getTransactionCount = sandbox.stub().resolves(100)

    sw.sendTransaction = sandbox.stub().throws(Error('Transaction nonce is too low'))
    const result = await sender.sendTx(txinfo, sendToQueue)

    // Result failed
    expect(result).eq(SendResult.nonceTooLow)
    // Nonce should be update by querying web3
    expect(await cache.get(sender.nonceKey)).eq('100')
  })

  it('Test sendTx with insufficient found', async () => {
    const gasUnit = toBN(10)
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTransaction = sandbox.stub().throws(Error('Insufficient funds'))
    const result = await sender.sendTx(txinfo, sendToQueue)

    expect(result).eq('insufficientFunds')
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq('50')
  })

  it('Test sendTx with block gas limit exceed', async () => {
    const gasUnit = toBN(10)
    const txinfo: TxInfo = {
      eventTask: fakeEvent,
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTransaction = sandbox.stub().throws(Error('exceeds block gas limit'))
    const result = await sender.sendTx(txinfo, sendToQueue)

    expect(result).eq(SendResult.blockGasLimitExceeded)
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq('50')
  })
})
