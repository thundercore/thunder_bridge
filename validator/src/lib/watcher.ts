import BN from 'bn.js'
import Web3 from 'web3'
import { BatchRequest } from '../tx/batch'
import { Contract, EventData, Filter } from 'web3-eth-contract'
import { PastLogsOptions } from 'web3-core'
import { toBN } from 'web3-utils'

import logger from '../services/logger'
import { EventTask } from './types'

const ONE = toBN(1)

export interface ProcessState {
  lastProcessedBlock: BN
  updateLastProcessedBlock: (lastBlockNumber: BN) => Promise<string | void>
}

export interface WatcherWeb3 {
  getLastBlockNumber: () => Promise<BN>
  getRequiredBlockConfirmations: () => Promise<BN>
  getEvents: (eventName: string, fromBlock: BN, toBlock: BN, filter: Filter) => Promise<EventData[]>
}

export interface KVStore {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<string>
}

export class ProcessStateImpl implements ProcessState {
  redis: KVStore
  startBlock: BN
  lastProcessedBlock: BN
  lastBlockRedisKey: string

  constructor(id: string, redis: KVStore, startBlock: BN) {
    this.redis = redis
    this.lastBlockRedisKey = `${id}:lastProcessedBlock`
    this.startBlock = startBlock
    this.lastProcessedBlock = toBN(0)
  }

  async getLastProcessedBlock() {
    const result = await this.redis.get(this.lastBlockRedisKey)
    logger.debug(
      {
        fromRedis: result,
        fromConfig: this.lastProcessedBlock ? this.lastProcessedBlock.toString() : '',
      },
      'Last Processed block obtained',
    )
    let startBlock = this.startBlock
    if (this.startBlock.lte(toBN(0))) {
      startBlock = toBN(0)
    }
    this.lastProcessedBlock = result ? toBN(result) : startBlock
  }

  async updateLastProcessedBlock(lastBlockNumber: BN) {
    this.lastProcessedBlock = lastBlockNumber
    return this.redis.set(this.lastBlockRedisKey, this.lastProcessedBlock.toString())
  }
}

export class WatcherWeb3Impl implements WatcherWeb3 {
  web3: Web3
  bridgeContract: Contract
  eventContract: Contract

  constructor(web3: Web3, bridgeContract: Contract, eventContract: Contract) {
    this.web3 = web3
    this.bridgeContract = bridgeContract
    this.eventContract = eventContract
  }

  async getLastBlockNumber(): Promise<BN> {
    let blockNumber: number
    try {
      logger.debug('Getting block number')
      blockNumber = await this.web3.eth.getBlockNumber()
      logger.debug({ blockNumber }, 'Block number obtained')
    } catch (e) {
      throw new Error(`Block Number cannot be obtained`)
    }
    return toBN(blockNumber)
  }

  async getRequiredBlockConfirmations(): Promise<BN> {
    let requiredBlockConfirmations: number
    try {
      const contractAddress = this.bridgeContract.options.address
      logger.debug({ contractAddress }, 'Getting required block confirmations')
      requiredBlockConfirmations = await this.bridgeContract.methods.requiredBlockConfirmations().call()
      logger.debug({ contractAddress, requiredBlockConfirmations }, 'Required block confirmations obtained')
    } catch (e) {
      throw new Error(`Required block confirmations cannot be obtained`)
    }
    return toBN(requiredBlockConfirmations)
  }

  async getEvents(eventName: string, fromBlock: BN, toBlock: BN, filter: Filter): Promise<EventData[]> {
    const contractAddress = this.eventContract.options.address
    logger.info(
      { contractAddress, eventName, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
      'Getting past events',
    )

    const event = this.eventContract.options.jsonInterface.find(function(item) {
      return item.type === 'event' && item.name === eventName
    })
    if (!event) {
      throw new Error(`${eventName} not in the contract's ABI`)
    }

    const batch = new BatchRequest(this.web3)

    // `toBlock` from the caller should be the latest block minus `getRequiredBlockConfirmations()`
    // @ts-ignore
    batch.add(this.web3.eth.getBlockNumber.request())

    const logFilter = this.encodeEventAbi(event, fromBlock, toBlock, filter)

    // @ts-ignore
    batch.add(this.web3.eth.getPastLogs.request(logFilter))

    let results
    try {
      results = await batch.execute()
    } catch (e) {
      throw new Error(`${eventName} events cannot be obtained: ${e}`)
    }

    const [latestBlock, logs] = results
    if (latestBlock < toBlock.toNumber()) {
      throw new Error(
        `${eventName} event cannot be obtained: getEvents(fromBlock: ${fromBlock.toNumber()}, toBlock: ${toBlock.toNumber()}) called when latest block reported by RPC node is ${latestBlock}`,
      )
    }
    let events
    try {
      // @ts-ignore
      events = logs.map((log) => this.decodeEventAbi(event, log))
    } catch (e) {
      throw new Error(`${eventName} events cannot be obtained, event decoding failed: ${e}`)
    }
    return events
  }

  encodeEventAbi(event: any, fromBlock: any, toBlock: any, filter: any): PastLogsOptions {
    const params = {
      address: this.eventContract.options.address.toLowerCase(),
      fromBlock: this.web3.utils.toHex(fromBlock),
      toBlock: this.web3.utils.toHex(toBlock),
      topics: [event.signature],
    }

    const indexedTopics = event.inputs
      .filter(function (i: any) {
        return i.indexed === true
      })
      .map((i: any) => {
        const value = filter[i.name]
        if (!value) {
          return null
        }
        return this.web3.eth.abi.encodeParameter(i.type, value)
      })

    params.topics = params.topics.concat(indexedTopics)
    return params
  }

  decodeEventAbi(event: any, result: any): EventData {
    const argTopics = result.topics.slice(1)
    result.returnValues = this.web3.eth.abi.decodeLog(event.inputs, result.data, argTopics)
    delete result.returnValues.__length__
    result.event = event.name
    result.signature = !result.topics[0] ? null : result.topics[0]
    result.raw = {
      data: result.data,
      topics: result.topics,
    }
    delete result.data
    delete result.topics
    return result
  }
}

export class EventWatcher {
  id: string
  event: string
  eventFilter: Filter
  web3: WatcherWeb3
  status: ProcessState

  constructor(id: string, event: string, eventFilter: Filter, web3: WatcherWeb3, status: ProcessState) {
    this.id = id
    this.event = event
    this.eventFilter = eventFilter
    this.web3 = web3
    this.status = status
  }

  async getLastBlockToProcess(): Promise<BN> {
    const lastBlockNumberPromise = this.web3.getLastBlockNumber()
    const requiredBlockConfirmationsPromise = this.web3.getRequiredBlockConfirmations()
    const [lastBlockNumber, requiredBlockConfirmations] = await Promise.all([
      lastBlockNumberPromise,
      requiredBlockConfirmationsPromise,
    ])

    return lastBlockNumber.sub(requiredBlockConfirmations)
  }

  async run(sendToQueue: (task: EventTask) => Promise<void>) {
    try {
      const lastBlockToProcess = await this.getLastBlockToProcess()
      const lastProcessedBlock = this.status.lastProcessedBlock

      if (lastBlockToProcess.lte(lastProcessedBlock)) {
        logger.debug('All blocks already processed')
        return
      }

      const fromBlock = lastProcessedBlock.add(ONE)
      const toBlock = lastBlockToProcess

      const events = await this.web3.getEvents(this.event, fromBlock, toBlock, this.eventFilter)
      logger.info(`Found ${events.length} ${this.event} events: ${JSON.stringify(events)}`)

      if (events.length) {
        events.map(async (event) => {
          const task: EventTask = {
            eventType: this.id,
            event,
          }
          await sendToQueue(task)
        })
      }

      logger.debug({ lastProcessedBlock: lastBlockToProcess.toString() }, 'Updating last processed block')
      await this.status.updateLastProcessedBlock(lastBlockToProcess)
    } catch (e) {
      logger.error(e)
    }

    logger.debug('Finished')
  }
}
