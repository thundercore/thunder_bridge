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
import { ReceiptTask } from "./lib/types"


async function initialize() {
  try {

    const checkHttps = checkHTTPS(config.ALLOW_HTTP, logger)

    rpcUrlsManager.homeUrls.forEach(checkHttps('home'))
    rpcUrlsManager.foreignUrls.forEach(checkHttps('foreign'))

    const web3 = new ReceiptorWeb3Impl(config.web3)
    const receiptor = new Receiptor(config.id, web3)

    connectReceiptorQueue({
      queueName: config.queue,
      cb: (options: { msg: Message; ackMsg: any; retryMsg: any; rejectMsg: any; sendToQueue: any }) => {
        let task = JSON.parse(options.msg.content.toString())

        let getReceipt = async (task: ReceiptTask) => {
          try {
            let result = await receiptor.run(task, options.sendToQueue)
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
                throw Error("No such result type")
            }
          } catch(e) {
            console.error(e)
            options.rejectMsg(options.msg)
            logger.error({error: e, queueTask: task}, 'queue message was rejected due to catched error')
          }
        }

        if (config.maxProcessingTime) {
          return watchdog(() => getReceipt(task), config.maxProcessingTime, () => {
            logger.fatal(`Max processing time ${config.maxProcessingTime} reached`)
            process.exit(EXIT_CODES.MAX_TIME_REACHED)
          })
        }

        return getReceipt(task)
      }
    })
  } catch (e) {
    console.error(e)
    logger.error(e.message)
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

initialize()
