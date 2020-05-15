const ForeignBridge = artifacts.require('ForeignBridgeErcToErc')
const HomeBridge = artifacts.require('HomeBridgeErcToErc')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken')
const path = require('path')

const sender = require(path.join(__dirname, '../src/lib/sender'))
const storage = require(path.join(__dirname, '../src/lib/storage'))
const queue = require(path.join(__dirname, '../src/lib/queue'))
const locker = require(path.join(__dirname, '../src/lib/locker'))
const { expect } = require('chai')

const deployed = require(path.join(__dirname, '../../data/deployed.json'))

const gasPriceService = {
  getPrice: async () => {
    return await web3.eth.getGasPrice()
  },
}


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
      name: 'mine',
      call: 'evm_mine',
      params: 1
    }
 ]
});

async function makeOneBlock() {
  begin = await web3.eth.getBlockNumber()
  await web3.miner.mine(Date.now())
  end = await web3.eth.getBlockNumber()
  console.log(`make block ${begin} -> ${end}`)
}


contract("Test single sender", async (accounts) => {
  foreign = new web3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address);
  home = new web3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address);
  erc20 = new web3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address);

  v1 = {
    address: accounts[1],
    privateKey: '4bf3b1bb36eb3f53d1ae5e6309510e17fe41df9a26a236de3385872211e0eab4',
  }

  let senderWeb3 = null
  let q = null
  let c = null
  let l = null

  beforeEach(() => {
    senderWeb3 = new sender.SenderWeb3Impl('v1', '5777', v1, web3, gasPriceService)
    q = new queue.FakeQueue()
    c = new storage.FakeCache()
    l = new locker.FakeLocker()
  })

  async function makeTransfer() {
    const receipt = await erc20.methods
      .transfer(foreign.options.address, web3.utils.toWei('0.01'))
      .send({ from: accounts[0] })
    return {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
  }

  it('test transfer success', async () => {
    const s = new sender.Sender('v1', q, senderWeb3, l, 1000, c)
    const task = await makeTransfer()

    // Send task first time with success result
    let ret = await s.run(task)
    expect(ret).to.eq('success')

    // Send task second time with skipped result
    ret = await s.run(task)
    expect(ret).to.eq('skipped')

    // Task is `acked` in queue twice
    expect(q.acks.length).to.equal(2)
    expect(q.acks.pop()).to.be.deep.equal(task)
  })

  it('test transfer with lower nonce will be failed', async () => {
    const task = await makeTransfer()

    const s = new sender.Sender('v1', q, senderWeb3, l, 1000, c)
    // Get and fix nonce to nonce-1.
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, (nonce - 1).toString())

    const ret = await s.run(task)
    // Expect ret == nonceTooLow and nonce will be updated to nonce
    expect(ret).to.eq(sender.SendResult.nonceTooLow)
    expect(await c.get(s.nonceKey)).to.equal(nonce.toString())
    expect(q.nacks.pop()).to.be.deep.equal(task)
  })

  it.skip("test tx was imported", async () => {
    // FIXME: truffle will return `the tx doesn't have the correct nonce` message.
    // It's different from geth. We skiped this test before we found a better way to test this case.
    const task = await makeTransfer()

    await web3.miner.stop()
    const w = new sender.SenderWeb3Impl("v1", '5777', v1, web3, gasPriceService);
    const s = new sender.Sender("v1", q, w, l, 1000, null);
    const info = await s.EventToTxInfo(task)

    const p1 = s.sendTx(info)
    const p2 = s.sendTx(info)
    await makeOneBlock()
    await web3.miner.start()

    const r1 = await p1
    const r2 = await p2
    expect(r1).to.be.eq("success")
    expect(r2).to.be.eq(sender.SendResult.txImported)
  })

  it('test gas limit exceeded', async () => {
    // TODO: maybe run another chain?
    const task = await makeTransfer()
    const s = new sender.Sender('v1', q, senderWeb3, l, 1000, c)
    const info = await s.EventToTxInfo(task)
    info.gasEstimate = 100000000000000

    const ret = await s.sendTx(info)
    expect(ret).to.eq(sender.SendResult.blockGasLimitExceeded)
  })

  it('test transfer with same nonce will be fail', async () => {
    const task = await makeTransfer()

    const s = new sender.Sender('v1', q, senderWeb3, l, 1000, c)
    // Fix nonce to same value
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, nonce)

    // First task will be success
    let ret = await s.run(task)
    expect(ret).to.eq('success')

    // Second task with same nonce will be fail.
    const newtask = await makeTransfer()
    await c.set(s.nonceKey, nonce)
    ret = await s.run(newtask)
    expect(ret).to.eq(sender.SendResult.nonceTooLow)
    expect(await c.get(s.nonceKey)).to.eq((nonce + 1).toString())
    // Task is not `acked` in queue
    expect(q.nacks.pop()).to.be.deep.equal(newtask)
  })
})

contract('Test multiple senders', (accounts) => {
  const foreign = new web3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address)
  const home = new web3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address)
  const erc20 = new web3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address)

  const v1 = {
    address: accounts[1],
    privateKey: '4bf3b1bb36eb3f53d1ae5e6309510e17fe41df9a26a236de3385872211e0eab4',
  }
  const v2 = {
    address: accounts[2],
    privateKey: '62911097680a3251a49e89d7b6f200b909acb13f8aba98ec4a0a77a71ab4f4e6',
  }
  const v3 = {
    address: accounts[3],
    privateKey: '7469990333fa18a8fed66b945970b3af09de3d6a5863535cf102b3938a7ff41a',
  }

  let q = null
  let l = null

  beforeEach(() => {
    q = new queue.FakeQueue()
    l = new locker.FakeLocker()
  })

  async function makeTransfer() {
    const receipt = await erc20.methods
      .transfer(foreign.options.address, web3.utils.toWei('0.01'))
      .send({ from: accounts[0] })
    return {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer,
    }
  }

  it('test third sender estimateGas will failed', async () => {
    const task = await makeTransfer()

    const v1web3 = new sender.SenderWeb3Impl('v1', '5777', v1, web3, gasPriceService)
    const v2web3 = new sender.SenderWeb3Impl('v2', '5777', v2, web3, gasPriceService)
    const v3web3 = new sender.SenderWeb3Impl('v3', '5777', v3, web3, gasPriceService)

    const s1 = new sender.Sender('v1', q, v1web3, l, 1000)
    const s2 = new sender.Sender('v2', q, v2web3, l, 1000)
    const s3 = new sender.Sender('v3', q, v3web3, l, 1000)

    // v1 and v2 vote first
    // EventToTxInfo will run estimateGas.
    const info1 = await s1.EventToTxInfo(task)
    const r1 = await s1.sendTx(info1)
    await makeOneBlock()

    const info2 = await s2.EventToTxInfo(task)
    const r2 = await s2.sendTx(info2)
    await makeOneBlock()

    expect(r1).to.eq('success')
    expect(r2).to.eq('success')
    // We expect gasR2 > gasR1 due to enough affirmations.
    expect(info2.gasEstimate).to.gt(info1.gasEstimate)

    // v3 estimateGas will failed because contract has enough affirmations.
    const info3 = await s3.EventToTxInfo(task)
    expect(info3).to.be.null
  })

  it('test three sender estimateGas race condition', async () => {
    const task = await makeTransfer()

    const v1web3 = new sender.SenderWeb3Impl('v1', '5777', v1, web3, gasPriceService)
    const v2web3 = new sender.SenderWeb3Impl('v2', '5777', v2, web3, gasPriceService)
    const v3web3 = new sender.SenderWeb3Impl('v3', '5777', v3, web3, gasPriceService)

    const s1 = new sender.Sender('v1', q, v1web3, l, 1000)
    const s2 = new sender.Sender('v2', q, v2web3, l, 1000)
    const s3 = new sender.Sender('v3', q, v3web3, l, 1000)

    // v1 and v2 vote first
    const info1 = await s1.EventToTxInfo(task)
    let info2 = await s2.EventToTxInfo(task)
    const r1 = await s1.sendTx(info1)
    await makeOneBlock()
    expect(r1).to.eq('success')

    // v2 will be fail because gas limit too low.
    const r2 = await s2.sendTx(info2)
    await makeOneBlock()
    expect(r2).to.eq('failed')

    // v3 estimateGas with a higher gas limit will be success
    const info3 = await s3.EventToTxInfo(task)
    const r3 = await s3.sendTx(info3)
    await makeOneBlock()
    expect(r3).to.eq('success')

    // We expect gasR3 > gasR2 due to enough affirmations.
    expect(info3.gasEstimate).to.gt(info2.gasEstimate)

    // v2 run estimateGas again will be skipped because enough affirmation
    info2 = await s2.EventToTxInfo(task)
    expect(info2).to.be.null
  })

  it('test three sender send in same block', async () => {
    const task = await makeTransfer()

    const v1web3 = new sender.SenderWeb3Impl('v1', '5777', v1, web3, gasPriceService)
    const v2web3 = new sender.SenderWeb3Impl('v2', '5777', v2, web3, gasPriceService)
    const v3web3 = new sender.SenderWeb3Impl('v3', '5777', v3, web3, gasPriceService)

    const s1 = new sender.Sender('v1', q, v1web3, l, 1000)
    const s2 = new sender.Sender('v2', q, v2web3, l, 1000)
    const s3 = new sender.Sender('v3', q, v3web3, l, 1000)

    const info1 = await s1.EventToTxInfo(task)
    const info2 = await s2.EventToTxInfo(task)
    const info3 = await s3.EventToTxInfo(task)
    const r1 = await s1.sendTx(info1)
    const r2 = await s2.sendTx(info2)
    const r3 = await s3.sendTx(info3)

    await makeOneBlock()

    expect(r1).to.eq('success')
    expect(r2).to.eq('failed')
    expect(r3).to.eq('failed')
  })
})
