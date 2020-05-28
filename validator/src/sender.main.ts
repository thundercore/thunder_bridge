import { SenderWeb3Impl, Sender, SendResult } from "./lib/sender"
import { loadValidatorFromAWS } from "../config/private-keys.config"
import { Message } from "amqplib"

import { connectSenderToQueue } from './services/amqpClient'
import { redis } from './services/redisClient'
import GasPrice from './services/gasPrice'
import logger = require('./services/logger')
import rpcUrlsManager from './services/getRpcUrlsManager'
import { checkHTTPS, watchdog } from './utils/utils'
import { EXIT_CODES } from './utils/constants'

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

import config from '../config'
import { RedisLocker } from "./lib/RedisLocker"
import { EventTask, isRetryTask } from "./lib/types"


async function newSender(): Promise<Sender> {
    let validator = await loadValidatorFromAWS()
    let chainId = await config.web3.eth.net.getId()
    GasPrice.start(config.id)
    let web3 = new SenderWeb3Impl(
        config.id, chainId, validator, config.web3, GasPrice
    )
    let redlock = new RedisLocker(config.REDIS_LOCK_TTL)
    return new Sender(config.id, web3, redlock, redis)
}


async function initialize() {
  try {

    const checkHttps = checkHTTPS(config.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const sender = await newSender()

    connectSenderToQueue({
      queueName: config.queue,
      cb: (options: { msg: Message; ackMsg: any; nackMsg: any; pushSenderQueue: any, pushReceiptorQueue: any }) => {
        let task = JSON.parse(options.msg.content.toString())

        let runSender = async (task: EventTask) => {
          try {
            let result = await sender.run(task, options.pushReceiptorQueue)
            switch (result) {
              case SendResult.success:
              case SendResult.skipped:
              case SendResult.txImported:
                options.ackMsg(options.msg)
                break

              case SendResult.failed:
              case SendResult.timeout:
              case SendResult.insufficientFunds:
                await options.pushSenderQueue(task)
                options.nackMsg(options.msg)
                break

              case SendResult.blockGasLimitExceeded:
                options.nackMsg(options.msg)
                break

              case SendResult.nonceTooLow:
                if (isRetryTask(task)) {
                  task.nonce = undefined
                }
                options.pushSenderQueue(task)
                options.nackMsg(options.msg)
                break

              default:
                options.nackMsg(options.msg)
                throw Error("No such result type")
            }
          } catch(e) {
            options.nackMsg(options.msg)
            logger.error({error: e, queueTask: task}, 'queue message was rejected due to run error')
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
