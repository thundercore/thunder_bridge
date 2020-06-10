require('dotenv').config()

import { EventWatcher, WatcherWeb3Impl, ProcessStateImpl } from './lib/watcher'

import * as path from 'path'
import logger = require('./services/logger')
import * as rpcUrlsManager from './services/getRpcUrlsManager'

import { connectWatcherToQueue, connection } from './services/amqpClient'
import { redis } from './services/redisClient'
import { checkHTTPS, watchdog } from './utils/utils'
import { EXIT_CODES } from './utils/constants'
import { EventTask, enqueue } from './lib/types'
import { loadValidatorFromAWS } from '../config/private-keys.config'

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const config = require(path.join('../config/', process.argv[2]))

async function NewWatcher(validator: {id: string}): Promise<EventWatcher> {
  const web3Instance = config.web3
  const bridgeContract = new web3Instance.eth.Contract(config.bridgeAbi, config.bridgeContractAddress)
  const eventContract = new web3Instance.eth.Contract(config.eventAbi, config.eventContractAddress)

  let web3 = new WatcherWeb3Impl(web3Instance, bridgeContract, eventContract)
  let state = new ProcessStateImpl(`${config.id}.${validator.id}`, redis, config.startBlock)
  await state.loadLastProcessedBlock()
  return new EventWatcher(config.id, config.event, config.eventFilter, web3, state)
}

interface watcherToQueueOption {
  enqueueSender: enqueue<EventTask>
}

async function initialize() {
  try {
    const validator = await loadValidatorFromAWS()
    const checkHttps = checkHTTPS(config.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const watcher = await NewWatcher(validator)
    connectWatcherToQueue({
      queueName: `${config.queue}.${validator.id}`,
      cb: (options: watcherToQueueOption) => loopRunner(watcher, options)
    })
  } catch (e) {
    logger.fatal(e, 'initailize raised unknown error.')
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}


async function loopRunner(watcher: EventWatcher, options: watcherToQueueOption) {
  if (connection.isConnected() && redis.status === 'ready') {
    if (config.maxProcessingTime) {
      await watchdog(() => watcher.run(options.enqueueSender), config.maxProcessingTime, () => {
        logger.fatal('Max processing time reached')
        process.exit(EXIT_CODES.MAX_TIME_REACHED)
      })
    } else {
      await watcher.run(options.enqueueSender)
    }
  }

  setTimeout(() => {
    loopRunner(watcher, options)
  }, config.pollingInterval)
}

initialize()