import Web3 from "web3"

const logger = require('./services/logger')

const ZERO = Web3.utils.toBN(0)
const ONE = Web3.utils.toBN(1)


class ProcessStatus {
  lastProcessedBlock = undefined

  constructor(id, redis, fallbackLastProcessedBlock) {
    this.redis = redis
    const lastBlockRedisKey = `${id}:lastProcessedBlock`

    this.getLastProcessedBlock(fallbackLastProcessedBlock)
  }

  async getLastProcessedBlock(fallbackLastProcessedBlock) {
    const result = await this.redis.get(this.lastBlockRedisKey)
    logger.debug(
      { fromRedis: result, fromConfig: this.lastProcessedBlock.toString() },
      'Last Processed block obtained'
    )
    this.lastProcessedBlock = result ? toBN(result) : fallbackLastProcessedBlock
  }

  async updateLastProcessedBlock(lastBlockNumber) {
    this.lastProcessedBlock = lastBlockNumber
    return this.redis.set(this.lastBlockRedisKey, this.lastProcessedBlock.toString())
  }

}

class Watcher {
  constructor(web3, status) {
    this.web3 = web3
    this.status = status
  }

  async getLastBlockToProcess() {
    const lastBlockNumberPromise = getBlockNumber(this.web3).then(toBN)
    const requiredBlockConfirmationsPromise = getRequiredBlockConfirmations(bridgeContract).then(toBN)
    const [lastBlockNumber, requiredBlockConfirmations] = await Promise.all([
      lastBlockNumberPromise,
      requiredBlockConfirmationsPromise
    ])

    return lastBlockNumber.sub(requiredBlockConfirmations)
  }

  async run({ sendToQueue }) {
    try {
      const lastBlockToProcess = await this.getLastBlockToProcess()

      if (lastBlockToProcess.lte(lastProcessedBlock)) {
        logger.debug('All blocks already processed')
        return
      }

      const fromBlock = lastProcessedBlock.add(ONE)
      const toBlock = lastBlockToProcess

      const events = await getEvents({
        contract: eventContract,
        event: config.event,
        fromBlock,
        toBlock,
        filter: config.eventFilter
      })
      logger.info(`Found ${events.length} ${config.event} events: ${JSON.stringify(events)}`)

      if (events.length) {
        await sendToQueue({
          eventType: config.id,
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
