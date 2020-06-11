import { Receiptor, ReceiptorWeb3Impl, ReceiptResult } from "./lib/receiptor"
import { Message } from "amqplib"

import { connectReceiptorQueue } from './services/amqpClient'
import logger = require('./services/logger')
import rpcUrlsManager from './services/getRpcUrlsManager'
import { checkHTTPS, watchdog } from './utils/utils'
import { EXIT_CODES } from './utils/constants'

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

import config from '../config'
import { ReceiptTask, enqueueSender } from "./lib/types"
import { loadValidatorFromAWS } from "../config/private-keys.config"

import * as Sentry from '@sentry/node';
import sentryInit from './lib/sentry'


interface receiptorToQueueOptions {
  msg: Message,
  ackMsg: (msg: Message) => Promise<void>,
  retryMsg: (msg: Message) => Promise<void>,
  rejectMsg: (msg: Message) => Promise<void>,
  enqueueSender: enqueueSender,
}

async function initialize() {
  try {
    const checkHttps = checkHTTPS(config.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const validator = await loadValidatorFromAWS()
    const web3 = new ReceiptorWeb3Impl(config.web3)
    const receiptor = new Receiptor(`${config.id}.${validator.id}`, web3)

    connectReceiptorQueue({
      queueName: `${config.queue}.${validator.id}`,
      cb: (options: receiptorToQueueOptions ) => {
        let task = JSON.parse(options.msg.content.toString())

        let getReceipt = async (task: ReceiptTask) => {
          let result: ReceiptResult;
          try {
            result = await receiptor.run(task, options.enqueueSender)
          } catch(e) {
            options.retryMsg(options.msg)
            logger.error({error: e, queueTask: task}, 'unknown error catched. retry queue message.')
            throw e
          }

          switch (result) {
            case ReceiptResult.success:
              options.ackMsg(options.msg)
              break

            case ReceiptResult.timeout:
            case ReceiptResult.waittingK:
            case ReceiptResult.waittingReceipt:
              options.retryMsg(options.msg)
              break

            case ReceiptResult.null:
            case ReceiptResult.failed:
              options.rejectMsg(options.msg)
              break

            default:
              throw Error("Receiptor.run() returns unknown result type")
          }
        } // end of getReceipt

        if (config.maxProcessingTime) {
          return watchdog(() => getReceipt(task), config.maxProcessingTime, () => {
            logger.fatal(`Max processing time ${config.maxProcessingTime} reached`)
            Sentry.captureMessage('Max processing time reached', Sentry.Severity.Fatal)
            process.exit(EXIT_CODES.MAX_TIME_REACHED)
          })
        }

        return getReceipt(task)
      }
    })
  } catch (e) {
    Sentry.captureException(e)
    logger.fatal(e, 'initailize raised unknown error.')
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

sentryInit()
initialize()