const ForeignBridge = artifacts.require("ForeignBridgeErcToErc");
const HomeBridge = artifacts.require("HomeBridgeErcToErc");
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken");
const path = require('path');
const sender = require(path.join(__dirname, '../src/lib/sender'));
const storage = require(path.join(__dirname, '../src/lib/storage'));
const queue = require(path.join(__dirname, '../src/lib/queue'));
const locker = require(path.join(__dirname, '../src/lib/locker'));
const config = require('../config/')
const privateKey = require('../config/private-keys.config')
const expect = require('chai').expect;
const stub = require('sinon').stub;

stub(privateKey, 'getValidatorKey').resolves('0xc9a740d37dcd6f274a21ec47d556cdab370c16bc99566d7a3479c014719c0cad')
const deployed = require(path.join(__dirname, '../../data/deployed.json'));

gasPriceService = {
    getPrice: async () => {
        return await web3.eth.getGasPrice();
    }
};

contract("ThunderBridge", async (accounts) => {
  var v1 = accounts[0]
  foreign = new web3.eth.Contract(ForeignBridge.abi, deployed.foreignBridge.address);
  home = new web3.eth.Contract(HomeBridge.abi, deployed.homeBridge.address);
  erc20 = new web3.eth.Contract(ERC677BridgeToken.abi, deployed.erc20Token.address);

  before(async () => {
    await config.initialize()
  })

  beforeEach(() => {
    senderWeb3 = new sender.SenderWeb3Impl("v1", '5777', v1, web3, gasPriceService);
    q = new queue.FakeQueue();
    c = new storage.FakeCache();
    l = new locker.FakeLocker();
  })

  async function makeTransfer() {
    receipt = await erc20.methods.transfer(foreign.options.address, web3.utils.toWei('0.01')).send({ from: accounts[0] })
    return {
      eventType: 'erc-erc-affirmation-request',
      event: receipt.events.Transfer
    };
  }

  it("test transfer success", async () => {
    s = new sender.Sender("v1", q, senderWeb3, l, 1000, c);
    task = await makeTransfer()

    // Send task first time with success result
    ret = await s.run(task)
    expect(ret).to.eq("success")

    // Send task second time with skipped result
    ret = await s.run(task)
    expect(ret).to.eq("skipped")

    // Task is `acked` in queue twice
    expect(q.acks.length).to.equal(2)
    expect(q.acks.pop()).to.be.deep.equal(task)
  })

  it("test transfer with lower nonce will be failed", async () => {
    task = await makeTransfer()

    s = new sender.Sender("v1", q, senderWeb3, l, 1000, c);
    // Get and fix nonce to nonce - 10
    const nonce = await s.readNonce(true)
    await c.set(s.nonceKey, nonce-10)

    ret = await s.run(task)
    // Expect ret == failed and nonce will be updated to nonce
    expect(ret).to.eq("failed")
    expect(await c.get(s.nonceKey)).to.equal(nonce.toString())
    expect(q.nacks.pop()).to.be.deep.equal(task)
  })

  it("test transfer with same nonce will be fail", async () => {
    task = await makeTransfer()

    s = new sender.Sender("v1", q, senderWeb3, l, 1000, c);
    // Fix nonce to same value
    const nonce = await s.readNonce(true)
    console.log("Nonce:", nonce)
    await c.set(s.nonceKey, nonce)

    // First task will be success
    ret = await s.run(task)
    expect(ret).to.eq("success")

    // Second task with same nonce will be fail.
    newtask = await makeTransfer()
    await c.set(s.nonceKey, nonce)
    ret = await s.run(newtask)
    expect(ret).to.eq("failed")
    // TODO: due to validator == contract owner, nonce will increase while makeTransfer
    expect(await c.get(s.nonceKey)).to.eq((nonce+2).toString())
    // Task is not `acked` in queue
    expect(q.nacks.pop()).to.be.deep.equal(newtask)
  })
})