import { SenderWeb3Impl, Sender, SendResult } from "./lib/sender"
import { loadValidatorFromAWS } from "../config/private-keys.config"
import { ChannelWrapper } from "amqp-connection-manager"
import { Message } from "amqplib"

require('dotenv').config()
import { connectSenderToQueue } from './services/amqpClient'
import { redis } from './services/redisClient'
import logger from './services/logger'
import rpcUrlsManager from './services/getRpcUrlsManager'
import { checkHTTPS, watchdog } from './utils/utils'
import { EXIT_CODES } from './utils/constants'

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

import config from '../config'
import { getChainId } from "./tx/web3"
import { RedisLocker } from "./lib/RedisLocker"
import { EventTask } from "./lib/types"


async function newSender(): Promise<Sender> {
    let chainId = await getChainId(config.id)
    let validator = await loadValidatorFromAWS()
    let web3 = new SenderWeb3Impl(
        config.id, chainId, validator, config.web3
    )
    let redlock = new RedisLocker(config.REDIS_LOCK_TTL)
    return new Sender(config.id, web3, redlock, redis)
}


async function initialize() {
  try {

    const checkHttps = checkHTTPS(process.env.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const sender = await newSender()

    connectSenderToQueue({
      queueName: config.queue,
      cb: (options: { msg: Message; ackMsg: any; nackMsg: any; sendToQueue: any; channel: ChannelWrapper }) => {
        let task = JSON.parse(options.msg.content.toString())

        let runSender = async (task: EventTask) => {
          let result = await sender.run(task)

          switch (result) {
            case SendResult.success:
            case SendResult.skipped:
            case SendResult.txImported:
            case SendResult.blockGasLimitExceeded:
              options.ackMsg(options.msg)
              break

            case SendResult.failed:
            case SendResult.nonceTooLow:
              await options.sendToQueue(options.msg)
              options.ackMsg(options.msg)
              break

            case SendResult.insufficientFunds:
              logger.error(`Insufficient funds.`)
              await options.sendToQueue(options.msg)
              options.ackMsg(options.msg)
              break

            default:
              options.nackMsg(options.msg)
              throw Error("No such result type")
          }
        }

        if (config.maxProcessingTime) {
          return watchdog(() => runSender(task), config.maxProcessingTime, () => {
            logger.fatal(`Max processing time ${config.maxProcessingTime} reached`)
            process.exit(EXIT_CODES.MAX_TIME_REACHED)
          })
        }

        return runSender(task)
      }
    })
  } catch (e) {
    logger.error(e.message)
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

initialize()
