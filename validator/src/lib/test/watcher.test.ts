import {
  EventWatcher,
  ProcessState,
  WatcherWeb3,
  WatcherTask,
  SendToQueue,
  WatcherWeb3Impl,
  ProcessStateImpl, KVStore
} from '../watcher'
import { describe, before } from 'mocha'
import { EventData, Filter} from 'web3-eth-contract';
import { toBN } from 'web3-utils';

import { expect } from 'chai';
import { equal } from 'assert';
import Web3 from 'web3'
import BN from 'bn.js'
import sinon from 'sinon';


class FakeProcessState implements ProcessState {
  lastProcessedBlock: BN

  async updateLastProcessedBlock(block: BN): Promise<void> {
    this.lastProcessedBlock = block
    return Promise.resolve()
  }
}

class FakeWatcherWeb3 implements WatcherWeb3 {
  lastBlockNumber: number = 0
  blockConfirmations: number = 0

  async getLastBlockNumber(): Promise<BN> {
    return Promise.resolve(toBN(this.lastBlockNumber))
  }

  async getRequiredBlockConfirmations(): Promise<BN> {
    return Promise.resolve(toBN(this.blockConfirmations))
  }
  async getEvents(event: string, fromBlock: BN, toBlock: BN, filter: Filter): Promise<EventData[]> {
    let ret: EventData[] = []
    ret.push({
      returnValues: {
        fromBlock: fromBlock.toNumber(),
        toBlock: toBlock.toNumber(),
      },
      raw: {
          data: '',
          topics: [],
      },
      event: event,
      signature: '',
      logIndex: 0,
      transactionIndex: fromBlock.toNumber(),
      transactionHash: '',
      blockHash: '',
      blockNumber: toBlock.toNumber(),
      address: '',
    })
    return Promise.resolve(ret)
  }
}


class FakeQueueSend implements SendToQueue {
  queue: WatcherTask[] = []

  async push(item: WatcherTask): Promise<void> {
    this.queue.push(item)
    return Promise.resolve()
  }
}

class MemKVStore implements KVStore {
  store: object = {}

  get(key: string): Promise<string> {
    return Promise.resolve(this.store[key])
  }

  set(key: string, value: string) {
    this.store[key] = value
    return Promise.resolve("OK")
  }
}

describe('Test EventWatcher', () => {
  var web3 = new FakeWatcherWeb3()
  var state = new FakeProcessState()
  var watcher = new EventWatcher('mytestcase', 'testevent', {}, web3, state)

  it("test get last block to process", async () => {
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    let lastBlockToProcess = await watcher.getLastBlockToProcess()
    expect(lastBlockToProcess.toString(), toBN(49).toString())
  })

  it("test all blocks have been processed", async () => {
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    state.lastProcessedBlock = toBN(50)
    let queue = new FakeQueueSend()
    await watcher.run(queue)
    equal(queue.queue.length, 0)
  })

  it("test process new block", async () => {
    // From: 45, To: (100 - 51)
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    state.lastProcessedBlock = toBN(45)
    let queue = new FakeQueueSend()
    await watcher.run(queue)

    equal(queue.queue.length, 1)
    let task = queue.queue.pop()
    let expection = {
      fromBlock: 46,
      toBlock: 49
    }
    expect(task.events.pop().returnValues).to.deep.equal(expection)

    let lastBlockToProcess = await watcher.getLastBlockToProcess()
    expect(lastBlockToProcess.toString(), toBN(49).toString())
  })
})


describe("Test WatcherWeb3Impl", () => {
  let sandbox: sinon.SinonSandbox

  before(() => { sandbox = sinon.sandbox.create(); })
  afterEach(() => { sandbox.restore(); })

  it("Test getLastBlockNumber", async () => {
    let provider = null
    let web3 = new Web3(provider)
    const Contract = web3.eth.Contract
    let contract = new Contract([])
    const getBlockNumber = sinon.stub(web3.eth, "getBlockNumber")
    getBlockNumber.resolves(10)

    let watcherWeb3 = new WatcherWeb3Impl(web3, contract, contract)
    let blockNumer = await watcherWeb3.getLastBlockNumber()
    expect(blockNumer.toNumber()).to.equal(10)
  })

  it("Test getRequiredBlockConfirmations", async () => {
    let provider = null
    let web3 = new Web3(provider)
    const Contract = web3.eth.Contract
    let bridgeContract = new Contract([])
    bridgeContract.methods = {
      requiredBlockConfirmations: () => ({ call: sinon.stub().resolves(10) }),
    }
    let eventContract = new Contract([])
    eventContract.methods = {
      requiredBlockConfirmations: () => ({ call: sinon.stub().resolves(50) }),
    }
    let watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    let blockNumer = await watcherWeb3.getRequiredBlockConfirmations()
    expect(blockNumer.toNumber()).to.equal(10)
  })
})

describe("Test ProcessStateImpl", () => {
  let sandbox: sinon.SinonSandbox

  before(() => { sandbox = sinon.createSandbox() })
  afterEach(() => { sandbox.restore() })

  it("init with empty store, use start block number", async () => {
    const memRedis = new MemKVStore()
    const ps = new ProcessStateImpl("test", memRedis, toBN(11));
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(11)
  })

  it("init with store, use value in store", async () => {
    const memRedis = new MemKVStore()
    memRedis.set("test:lastProcessedBlock", toBN(123).toString())
    const ps = new ProcessStateImpl("test", memRedis, toBN(11));
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(123)
  })

  it("update last processed block", async () => {
    const memRedis = new MemKVStore()
    const ps = new ProcessStateImpl("test", memRedis, toBN(11));
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(11)
    await ps.updateLastProcessedBlock(toBN(1234))
    expect(ps.lastProcessedBlock.toNumber()).to.equal(1234)
  })
})
