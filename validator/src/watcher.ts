require('dotenv').config()

import { EventWatcher, WatcherWeb3Impl, ProcessStateImpl } from './lib/watcher'

import * as path from 'path'
import * as logger from './services/logger'
import * as rpcUrlsManager from './services/getRpcUrlsManager'

import { connectWatcherToQueue, connection } from './services/amqpClient'
import { redis } from './services/redisClient'
import { checkHTTPS, watchdog } from './utils/utils'
import { EXIT_CODES } from './utils/constants'

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const config = require(path.join('../config/', process.argv[2]))

function NewWatcher(): EventWatcher {
  const web3Instance = config.web3
  const bridgeContract = new web3Instance.eth.Contract(config.bridgeAbi, config.bridgeContractAddress)
  const eventContract = new web3Instance.eth.Contract(config.eventAbi, config.eventContractAddress)

  let web3 = new WatcherWeb3Impl(web3Instance, bridgeContract, eventContract)
  let state = new ProcessStateImpl(config.id, redis, config.startBlock)
  return new EventWatcher(config.id, config.event, config.eventFilter, web3, state)
}

let watcher = NewWatcher()

async function initialize() {
  try {
    await config.initialize()
    const checkHttps = checkHTTPS(process.env.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    connectWatcherToQueue({
      queueName: config.queue,
      cb: loopRunner
    })
  } catch (e) {
    logger.error(e)
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

async function loopRunner({ sendToQueue }) {
  try {
    if (connection.isConnected() && redis.status === 'ready') {
      if (config.maxProcessingTime) {
        await watchdog(() => watcher.run(sendToQueue), config.maxProcessingTime, () => {
          logger.fatal('Max processing time reached')
          process.exit(EXIT_CODES.MAX_TIME_REACHED)
        })
      } else {
        await watcher.run(sendToQueue)
      }
    }
  } catch (e) {
    logger.error(e)
  }

  setTimeout(() => {
    loopRunner({ sendToQueue })
  }, config.pollingInterval)

}

initialize()