import {
  EventWatcher,
  ProcessState,
  WatcherWeb3,
  WatcherWeb3Impl,
  ProcessStateImpl,
  KVStore,
} from "../watcher"
import { describe, before } from 'mocha'
import { EventData, Filter } from 'web3-eth-contract'
import { toBN } from 'web3-utils'

import { expect, assert } from 'chai'
import { strictEqual } from 'assert'
import Web3 from 'web3'
// @ts-ignore
import requestManager from 'web3-core-requestmanager'
import BN from 'bn.js'
import sinon from 'sinon'
import { EventTask } from '../types'

class FakeProcessState implements ProcessState {
  lastProcessedBlock: BN = toBN(0)

  async updateLastProcessedBlock(block: BN): Promise<void> {
    this.lastProcessedBlock = block
    return Promise.resolve()
  }
}

class FakeWatcherWeb3 implements WatcherWeb3 {
  lastBlockNumber = 0
  blockConfirmations = 0

  async getLastBlockNumber(): Promise<BN> {
    return Promise.resolve(toBN(this.lastBlockNumber))
  }

  async getRequiredBlockConfirmations(): Promise<BN> {
    return Promise.resolve(toBN(this.blockConfirmations))
  }

  async getEvents(event: string, fromBlock: BN, toBlock: BN, filter: Filter): Promise<EventData[]> {
    const ret: EventData[] = [
      {
        returnValues: {
          fromBlock: fromBlock.toNumber(),
          toBlock: toBlock.toNumber(),
        },
        raw: {
          data: '',
          topics: [],
        },
        event,
        signature: '',
        logIndex: 0,
        transactionIndex: fromBlock.toNumber(),
        transactionHash: '',
        blockHash: '',
        blockNumber: toBlock.toNumber(),
        address: '',
      },
    ]
    return Promise.resolve(ret)
  }
}

class MemKVStore implements KVStore {
  store: {
    [key: string]: string
  } = {}

  get(key: string): Promise<string> {
    return Promise.resolve(this.store[key])
  }

  set(key: string, value: string) {
    this.store[key] = value
    return Promise.resolve('OK')
  }
}

describe('Test EventWatcher', () => {
  const web3 = new FakeWatcherWeb3()
  const state = new FakeProcessState()
  const watcher = new EventWatcher('mytestcase', 'testevent', {}, web3, state)

  it('test get last block to process', async () => {
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    const lastBlockToProcess = await watcher.getLastBlockToProcess()
    expect(lastBlockToProcess.toString(), toBN(49).toString())
  })

  it('test all blocks have been processed', async () => {
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    state.lastProcessedBlock = toBN(50)
    let queue: any[] = []
    let sendToQueue = (item: EventTask): Promise<void> => {
      queue.push(item)
      return Promise.resolve()
    }
    await watcher.run(sendToQueue)
    strictEqual(queue.length, 0)
  })

  it('test process new block', async () => {
    // From: 45, To: (100 - 51)
    web3.lastBlockNumber = 100
    web3.blockConfirmations = 51
    state.lastProcessedBlock = toBN(45)
    let queue: any[] = []
    let sendToQueue = (item: EventTask): Promise<void> => {
      queue.push(item)
      return Promise.resolve()
    }
    await watcher.run(sendToQueue)

    strictEqual(queue.length, 1)
    let task = queue.pop()
    let expectation = {
      fromBlock: 46,
      toBlock: 49,
    }
    assert.isDefined(task)
    if (task) {
      expect(task.event.returnValues).to.deep.equal(expectation)
    }

    const lastBlockToProcess = await watcher.getLastBlockToProcess()
    expect(lastBlockToProcess.toString(), toBN(49).toString())
  })
})

describe('Test WatcherWeb3Impl', () => {
  let sandbox: sinon.SinonSandbox

  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })

  it('Test getLastBlockNumber', async () => {
    const provider = null
    const web3 = new Web3(provider)
    const Contract = web3.eth.Contract
    const contract = new Contract([])
    const getBlockNumber = sinon.stub(web3.eth, 'getBlockNumber')
    getBlockNumber.resolves(10)

    const watcherWeb3 = new WatcherWeb3Impl(web3, contract, contract)
    const blockNumber = await watcherWeb3.getLastBlockNumber()
    expect(blockNumber.toNumber()).to.equal(10)
  })

  it('Test getRequiredBlockConfirmations', async () => {
    const provider = null
    const web3 = new Web3(provider)
    const Contract = web3.eth.Contract
    const bridgeContract = new Contract([])
    bridgeContract.methods = {
      requiredBlockConfirmations: () => ({ call: sinon.stub().resolves(10) }),
    }
    const eventContract = new Contract([])
    eventContract.methods = {
      requiredBlockConfirmations: () => ({ call: sinon.stub().resolves(50) }),
    }
    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const blockNumber = await watcherWeb3.getRequiredBlockConfirmations()
    expect(blockNumber.toNumber()).to.equal(10)
  })
})

describe('Test WatcherWeb3Impl getEvents', () => {
  it('normal case', async () => {
    // mock sendBatch
    const web3 = new Web3()
    const rm = new requestManager.Manager()
    sinon.stub(rm, 'sendBatch').callsArgWith(1, null, [
      {
        jsonrpc: '2.0',
        id: 1,
        result: '0xa',
      },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [
          {
            address: '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              '0x000000000000000000000000d966b79302aa733d23bf91a0edabc106bb8af1a9',
              '0x0000000000000000000000002c66e58c123fe807ef9c36682257fa6bfb4afa52',
            ],
            data: '0x0000000000000000000000000000000000000000000000000000000009b5cf30',
            blockNumber: '0x1',
            transactionHash: '0x80a9bcaeb3f189b93fe83164a5714e8f27cd8439475ec9b2f4bc1ff83a0a4476',
            transactionIndex: '0x0',
            blockHash: '0xa9d64c8a9c83024dceef8e309c66b4cfc8d89e73fea4e2340361d82a4d46f13b',
            logIndex: '0x0',
            removed: false,
          },
        ],
      },
    ])
    web3.BatchRequest = requestManager.BatchManager.bind(null, rm)

    const bridgeContract = new web3.eth.Contract([])
    const eventContract = new web3.eth.Contract(
      [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
          name: 'Transfer',
          type: 'event',
        },
      ],
      '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    )

    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const fromBlock = toBN(0)
    const toBlock = toBN(10)
    const events = await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {})
    expect(events).length(1)
    expect(events[0].returnValues.from).to.equal(
      web3.utils.toChecksumAddress('0xd966b79302aa733d23bf91a0edabc106bb8af1a9'),
    )
    expect(events[0].returnValues.to).to.equal(
      web3.utils.toChecksumAddress('0x2c66e58c123fe807ef9c36682257fa6bfb4afa52'),
    )
    expect(events[0].returnValues.value).to.equal(
      web3.utils.hexToNumberString('0x0000000000000000000000000000000000000000000000000000000009b5cf30'),
    )
    expect(events[0].event).to.equal('Transfer')
  })

  it('test encode event ABI', async () => {
    // mock sendBatch
    const web3 = new Web3()
    const rm = new requestManager.Manager()
    sinon.stub(rm, 'sendBatch').callsArgWith(1, null, [
      {
        jsonrpc: '2.0',
        id: 1,
        result: '0xa',
      },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [],
      },
    ])
    web3.BatchRequest = requestManager.BatchManager.bind(null, rm)

    const bridgeContract = new web3.eth.Contract([])
    const eventContract = new web3.eth.Contract(
      [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
          name: 'Transfer',
          type: 'event',
        },
      ],
      '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    )
    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const fromBlock = toBN(0)
    const toBlock = toBN(10)
    await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {})

    let request1
    let request2
    expect(rm.sendBatch.lastCall.args).length(2)
    request1 = rm.sendBatch.lastCall.args[0][0]
    request2 = rm.sendBatch.lastCall.args[0][1]
    expect(request1.method).to.equal('eth_blockNumber')
    expect(request2.method).to.equal('eth_getLogs')
    expect(request2.params).to.deep.equal([
      {
        fromBlock: `0x${fromBlock.toString('hex')}`,
        toBlock: `0x${toBlock.toString('hex')}`,
        address: eventContract.options.address.toLowerCase(),
        topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', null, null],
      },
    ])

    await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {
      to: '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    })
    expect(rm.sendBatch.lastCall.args).length(2)
    request1 = rm.sendBatch.lastCall.args[0][0]
    request2 = rm.sendBatch.lastCall.args[0][1]
    expect(request1.method).to.equal('eth_blockNumber')
    expect(request2.method).to.equal('eth_getLogs')
    expect(request2.params).to.deep.equal([
      {
        fromBlock: `0x${fromBlock.toString('hex')}`,
        toBlock: `0x${toBlock.toString('hex')}`,
        address: eventContract.options.address.toLowerCase(),
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          null,
          '0x0000000000000000000000004f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
        ],
      },
    ])

    await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {
      from: '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    })
    expect(rm.sendBatch.lastCall.args).length(2)
    request1 = rm.sendBatch.lastCall.args[0][0]
    request2 = rm.sendBatch.lastCall.args[0][1]
    expect(request1.method).to.equal('eth_blockNumber')
    expect(request2.method).to.equal('eth_getLogs')
    expect(request2.params).to.deep.equal([
      {
        fromBlock: `0x${fromBlock.toString('hex')}`,
        toBlock: `0x${toBlock.toString('hex')}`,
        address: eventContract.options.address.toLowerCase(),
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x0000000000000000000000004f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
          null,
        ],
      },
    ])
  })

  it('test event not in contract ABI', async () => {
    const web3 = new Web3()
    const bridgeContract = new web3.eth.Contract([])
    const eventContract = new web3.eth.Contract(
      [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
          name: 'Transfer',
          type: 'event',
        },
        {
          constant: true,
          inputs: [],
          name: 'totalSupply',
          outputs: [{ name: '', type: 'uint256' }],
          payable: false,
          stateMutability: 'view',
          type: 'function',
        },
      ],
      '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    )
    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const fromBlock = toBN(0)
    const toBlock = toBN(10)
    let err
    try {
      await watcherWeb3.getEvents('Transfe', fromBlock, toBlock, {})
    } catch (e) {
      err = e
    }
    expect(err.message).to.have.string("not in the contract's ABI")

    try {
      await watcherWeb3.getEvents('totalSupply', fromBlock, toBlock, {})
    } catch (e) {
      err = e
    }
    expect(err.message).to.have.string("not in the contract's ABI")
  })

  it('test latest block number < to block', async () => {
    // mock sendBatch
    const web3 = new Web3()
    const rm = new requestManager.Manager()
    sinon.stub(rm, 'sendBatch').callsArgWith(1, null, [
      {
        jsonrpc: '2.0',
        id: 1,
        result: '0x9',
      },
      {
        jsonrpc: '2.0',
        id: 2,
        result: [],
      },
    ])
    web3.BatchRequest = requestManager.BatchManager.bind(null, rm)

    const bridgeContract = new web3.eth.Contract([])
    const eventContract = new web3.eth.Contract(
      [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
          name: 'Transfer',
          type: 'event',
        },
      ],
      '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    )
    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const fromBlock = toBN(0)
    const toBlock = toBN(10)
    let err
    try {
      await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {})
    } catch (e) {
      err = e
    }
    expect(err.message).to.have.string('called when latest block reported by RPC node is')
  })

  it('test decode execute fail', async () => {
    const web3 = new Web3()
    const rm = new requestManager.Manager()
    sinon.stub(rm, 'sendBatch').throws('QQ')
    web3.BatchRequest = requestManager.BatchManager.bind(null, rm)

    const bridgeContract = new web3.eth.Contract([])
    const eventContract = new web3.eth.Contract(
      [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
          name: 'Transfer',
          type: 'event',
        },
      ],
      '0x4f3c8e20942461e2c3bdd8311ac57b0c222f2b82',
    )
    const watcherWeb3 = new WatcherWeb3Impl(web3, bridgeContract, eventContract)
    const fromBlock = toBN(0)
    const toBlock = toBN(10)
    let err
    try {
      await watcherWeb3.getEvents('Transfer', fromBlock, toBlock, {})
    } catch (e) {
      err = e
    }
    expect(err.message).to.have.string('QQ')
  })
})

describe('Test ProcessStateImpl', () => {
  let sandbox: sinon.SinonSandbox

  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })

  it('init with empty store, use start block number', async () => {
    const memRedis = new MemKVStore()
    const ps = new ProcessStateImpl('test', memRedis, toBN(11))
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(11)
  })

  it('init with store, use value in store', async () => {
    const memRedis = new MemKVStore()
    memRedis.set('test:lastProcessedBlock', toBN(123).toString())
    const ps = new ProcessStateImpl('test', memRedis, toBN(11))
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(123)
  })

  it('update last processed block', async () => {
    const memRedis = new MemKVStore()
    const ps = new ProcessStateImpl('test', memRedis, toBN(11))
    await ps.getLastProcessedBlock()
    expect(ps.lastProcessedBlock.toNumber()).to.equal(11)
    await ps.updateLastProcessedBlock(toBN(1234))
    expect(ps.lastProcessedBlock.toNumber()).to.equal(1234)
  })
})
