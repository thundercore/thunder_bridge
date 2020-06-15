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
import { EventTask, isRetryTask, enqueueSender, enqueueReceiptor } from "./lib/types"

import * as Sentry from '@sentry/node';
import sentryInit from './lib/sentry'

async function newSender(validator: {id: string, address: string, privateKey: string}): Promise<Sender> {
    const chainId = await config.web3.eth.net.getId()
    GasPrice.start(config.id)
    const name = `${config.name}.${validator.id}`
    const web3 = new SenderWeb3Impl(
        name, chainId, validator, config.web3, GasPrice
    )
    let redlock = new RedisLocker(config.REDIS_LOCK_TTL)
    return new Sender(name, web3, redlock, redis)
}


interface senderToQueueOption {
  msg: Message,
  ackMsg: (msg: Message) => Promise<void>,
  nackMsg: (msg: Message) => Promise<void>,
  enqueueSender: enqueueSender,
  enqueueReceiptor: enqueueReceiptor,
}

async function initialize() {
  try {

    const checkHttps = checkHTTPS(config.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const validator = await loadValidatorFromAWS()
    const sender = await newSender(validator)

    connectSenderToQueue({
      queueName: `${config.queue}.${validator.id}`,
      cb: (options: senderToQueueOption) => {
        let task = JSON.parse(options.msg.content.toString())

        let runSender = async (task: EventTask) => {
          let result: SendResult;
          try {
            result = await sender.run(task, options.enqueueReceiptor)
          } catch(e) {
            Sentry.captureException(e)
            logger.error({error: e, queueTask: task}, 'queue message was re-enqueue due to error')
            await options.enqueueSender(task)
            await options.nackMsg(options.msg)
            throw e
          }

          switch (result) {
            case SendResult.success:
            case SendResult.skipped:
            case SendResult.sendDummyTxToFillNonce:
            case SendResult.txImported:
              options.ackMsg(options.msg)
              break

            case SendResult.failed:
            case SendResult.timeout:
            case SendResult.insufficientFunds:
              await options.enqueueSender(task)
              await options.nackMsg(options.msg)
              break

            case SendResult.blockGasLimitExceeded:
              options.nackMsg(options.msg)
              break

            case SendResult.nonceTooLow:
              if (isRetryTask(task)) {
                task.nonce = undefined
              }
              await options.enqueueSender(task)
              await options.nackMsg(options.msg)
              break

            default:
              await options.enqueueSender(task)
              options.nackMsg(options.msg)
              throw Error("No such result type")
          } // end of switch
        } // end of runSender

        if (config.maxProcessingTime) {
          return watchdog(() => runSender(task), config.maxProcessingTime, () => {
            Sentry.captureMessage(`Max processing time ${config.maxProcessingTime} reached`)
            logger.fatal(`Max processing time ${config.maxProcessingTime} reached`)
            process.exit(EXIT_CODES.MAX_TIME_REACHED)
          })
        }
        return runSender(task)
      } // end of cb
    }) // end of connectSenderToQueue

  } catch (e) {
    Sentry.captureException(e)
    logger.fatal(e, 'initailize raised unknown error.')
    process.exit(EXIT_CODES.GENERAL_ERROR)
  } // end of try-catch
}

sentryInit()
initialize()