import Web3 from 'web3'
import { expect } from 'chai'
import { createSandbox } from 'sinon'
import { TransactionReceipt } from 'web3-core'
import { EXTRA_GAS_PERCENTAGE } from '../../utils/constants'

import { FakeCache } from "../storage"
import { FakeQueue } from '../queue'
import { FakeLocker } from '../locker'
import { Sender, SenderWeb3Impl } from '../sender'
import { TxInfo } from '../types'
import { toBN } from 'web3-utils'
import { BigNumber } from 'bignumber.js'
import { addExtraGas } from '../../utils/utils'

var sandbox = createSandbox()

describe("Test Sender", () => {
  let web3 = new Web3(null)
  let sw = new SenderWeb3Impl("myid", 100, "0x000", web3, null)
  let cache = new FakeCache()
  let queue = new FakeQueue()
  let lock = new FakeLocker()
  let sender = new Sender("myid", queue, sw, lock, 3, cache)

  beforeEach(() => {
    web3 = new Web3(null)
    sw = new SenderWeb3Impl("myid", 100, "0x000", web3, null)
    cache = new FakeCache()
    queue = new FakeQueue()
    lock = new FakeLocker()
    sender = new Sender("myid", queue, sw, lock, 3, cache)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('Test nonce', async () => {
    web3.eth.getTransactionCount = sandbox.stub().resolves(20)
    // Cache miss
    expect(await sender.readNonce(false)).to.be.equal(20)

    // Cache hit
    await cache.set(sender.nonceKey, "10")
    expect(await sender.readNonce(false)).to.be.equal(10)
    expect(await cache.get(sender.nonceKey)).to.be.equal("10")

    // Force update
    web3.eth.getTransactionCount = sandbox.stub().resolves(50)
    expect(await sender.readNonce(true)).to.be.equal(50)

    await sender.updateNonce(20)
    expect(await cache.get(sender.nonceKey)).to.be.equal("20")
  })

  it('Test sendTx success', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    let nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    let receipt: TransactionReceipt = {
      status: true,
      transactionHash: "my transaction hash",
      transactionIndex: 10,
      blockHash: 'my block hash',
      blockNumber: 100,
      from: 'thunder',
      to: 'core',
      cumulativeGasUsed: 50,
      gasUsed: 30,
      logs: [],
      logsBloom: 'my logs bloom'
    }
    let s = sandbox.stub().resolves(receipt)
    sw.sendTx = s

    let result = await sender.sendTx(txinfo)

    expect(s.lastCall.args[0]).to.be.equal(nonce)
    // Expect call args: gasEstimate = txinfo.gasEstimate * EXTRA_GAS_PERCENTAGE
    let expectedGas = addExtraGas(gasUnit, EXTRA_GAS_PERCENTAGE)
    expect(s.lastCall.args[1]).to.be.deep.equal(expectedGas)
    expect(s.lastCall.args[2]).to.be.deep.equal(toBN('0'))
    expect(s.lastCall.args[3]).to.be.deep.equal(txinfo)

    // Result success
    expect(result).eq("success")
    // Nonce++
    expect(await cache.get(sender.nonceKey)).eq("51")
  })

  it('Test sendTx with tx already imported', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    let nonce = 50
    sender.readNonce = sandbox.stub().resolves(nonce)
    sw.sendTx = sandbox.stub().throws(Error("Transaction with the same hash was already imported"))

    let result = await sender.sendTx(txinfo)
    expect(result).eq("success")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })

  it('Test sendTx with low nonce', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    // chain nonce: 100 > cached nonce 50
    await cache.set(sender.nonceKey, "50")
    web3.eth.getTransactionCount = sandbox.stub().resolves(100)

    sw.sendTx = sandbox.stub().throws(Error("Transaction nonce is too low"))
    let result = await sender.sendTx(txinfo)

    // Result failed
    expect(result).eq("failed")
    // Nonce should be update by querying web3
    expect(await cache.get(sender.nonceKey)).eq("100")
  })

  it('Test sendTx with insufficient found', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTx = sandbox.stub().throws(Error("Insufficient funds"))
    let result = await sender.sendTx(txinfo)

    expect(result).eq("insufficientFunds")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })

  it('Test sendTx with block gas limit exceed', async () => {
    let gasUnit = toBN(10)
    let txinfo: TxInfo = {
      gasEstimate: gasUnit,
      transactionReference: 'test_send_tx_success',
      data: 'send_tx_data',
      to: 'thundercore',
    }

    sender.readNonce = sandbox.stub().resolves(50)

    sw.sendTx = sandbox.stub().throws(Error("exceeds block gas limit"))
    let result = await sender.sendTx(txinfo)

    expect(result).eq("success")
    // Nonce should not be ++
    expect(await cache.get(sender.nonceKey)).eq("50")
  })
})