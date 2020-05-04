import { toBN } from 'web3-utils';
import { Contract, EventData, PastEventOptions, Filter } from 'web3-eth-contract';
import Web3 from 'web3';

import logger from "../services/logger"
import BN from 'bn.js';

const ZERO = toBN(0)
const ONE = toBN(1)

export interface ProcessState {
  lastProcessedBlock: BN
  updateLastProcessedBlock: (lastBlockNumber: BN) => Promise<void>
}

export interface WatcherWeb3 {
  getLastBlockNumber: () => Promise<BN>
  getRequiredBlockConfirmations: () => Promise<BN>
  getEvents: (event: string, fromBlock: BN, toBlock: BN, filter: Filter) => Promise<EventData[]>
}


export interface KVStore {
    get: (key: string) => Promise<string>
    set: (key: string, value: string) => Promise<string>
}

export class ProcessStateImpl implements ProcessState {
  redis: any
  startBlock: BN
  lastProcessedBlock: BN
  lastBlockRedisKey: string

  constructor(id: string, redis: KVStore, startBlock: BN) {
    this.redis = redis
    this.lastBlockRedisKey = `${id}:lastProcessedBlock`
    this.startBlock = startBlock
  }

  async getLastProcessedBlock() {
    const result = await this.redis.get(this.lastBlockRedisKey)
    logger.debug(
      { fromRedis: result, fromConfig: this.lastProcessedBlock?.toString() },
      'Last Processed block obtained'
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
    } catch(e) {
      throw new Error(`Block Number cannot be obtained`)
    }
    return toBN(blockNumber);
  }

  async getRequiredBlockConfirmations(): Promise<BN> {
    let requiredBlockConfirmations: number
    try {
      const contractAddress = this.bridgeContract.options.address
      logger.debug({ contractAddress }, 'Getting required block confirmations')
      requiredBlockConfirmations = await this.bridgeContract.methods.requiredBlockConfirmations().call()
      logger.debug(
        { contractAddress, requiredBlockConfirmations },
        'Required block confirmations obtained'
      )
    } catch (e) {
      throw new Error(`Required block confirmations cannot be obtained`)
    }
    return toBN(requiredBlockConfirmations);
  }

  async getEvents(event: string, fromBlock: BN, toBlock: BN, filter: Filter):  Promise<EventData[]> {
    try {
      const contractAddress = this.eventContract.options.address
      logger.info(
        { contractAddress, event, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
        'Getting past events'
      )
      let option: PastEventOptions = {
          fromBlock: fromBlock.toNumber(),
          toBlock: toBlock.toNumber(),
          filter: filter
      }
      const pastEvents = await this.eventContract.getPastEvents(event, option)
      logger.debug({ contractAddress, event, count: pastEvents.length }, 'Past events obtained')
      return pastEvents
    } catch (e) {
      throw new Error(`${event} events cannot be obtained`)
    }
  }
}

export interface WatcherTask {
  eventType: string
  events: any
}

export interface SendToQueue {
  push: (item: WatcherTask) => Promise<void>
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
      requiredBlockConfirmationsPromise
    ])

    return lastBlockNumber.sub(requiredBlockConfirmations)
  }

  async run(sendToQueue: SendToQueue) {
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
        await sendToQueue.push({
          eventType: this.id,
          events: events,
        })
      }

      logger.debug(
        { lastProcessedBlock: lastBlockToProcess.toString() },
        'Updating last processed block'
      )
      await this.status.updateLastProcessedBlock(lastBlockToProcess)
    } catch (e) {
      logger.error(e)
    }

    logger.debug('Finished')
  }
}
