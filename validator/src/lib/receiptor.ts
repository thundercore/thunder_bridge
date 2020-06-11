import Web3 from 'web3'
import { TransactionReceipt } from 'web3-core'
import { ReceiptTask, EventTask, enqueueSender} from './types'

import config = require('../../config')
import rootLogger = require('../services/logger')

import * as Sentry from '@sentry/node';

interface ReceiptorWeb3 {
  getCurrentBlock: () => Promise<number>
  getTransactionReceipt: (transactionHash: string) => Promise<TransactionReceipt>
}

export class ReceiptorWeb3Impl implements ReceiptorWeb3 {
  web3: Web3

  constructor(web3: Web3) {
    this.web3 = web3
  }

  async getCurrentBlock(): Promise<number> {
    return this.web3.eth.getBlockNumber()
  }

  async getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    return this.web3.eth.getTransactionReceipt(transactionHash)
  }
}

export enum ReceiptResult {
  skipped = 'skipped',
  success = 'success',
  null = 'null',
  timeout = 'timeout',
  failed = 'failed',
  unknown = 'unknown',
  waittingK = 'waitting K block',
  waittingReceipt = 'waitting tx receipt',
}

class TimeoutError extends Error {}

export class Receiptor {
  web3: ReceiptorWeb3
  logger: any

  constructor(id: string, web3: ReceiptorWeb3) {
    this.web3 = web3
    this.logger = rootLogger.child({
      receiptId: id,
    })
  }

  async resendEvent(
    task: ReceiptTask,
    nonce: number|undefined,
    enqueueSender: enqueueSender): Promise<void> {

    const newTask: EventTask = {
      ...task.eventTask,
      nonce: nonce,
      retries: task.retries ? task.retries+1 : 1,
      timestamp: task.timestamp,
    }
    this.logger.debug({ ...newTask }, 'resend event task')
    return enqueueSender(newTask)
  }

  async checkBlockAdvencedK(block: number, k: number): Promise<boolean> {
    const currBlock = await this.web3.getCurrentBlock()
    this.logger.debug({ block, currBlock, k }, `check if currBlock - block >= k`)
    // TODO: K is >= or >?
    return Promise.resolve(currBlock - block >= k)
  }

  async getReceipt(task: ReceiptTask): Promise<TransactionReceipt | null> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(async () => {
        reject(new TimeoutError())
      }, config.GET_RECEIPT_TIMEOUT)

      this.logger.info({ timeout: config.GET_RECEIPT_TIMEOUT, tx: task.transactionHash }, 'Try to get receipt.')
      resolve(await this.web3.getTransactionReceipt(task.transactionHash))
      clearTimeout(timer)
    })
  }

  async run(task: ReceiptTask, enqueueSender: enqueueSender): Promise<ReceiptResult> {
    let receipt: TransactionReceipt | null
    try {
      receipt = await this.getReceipt(task)
    } catch (e) {
      if (e instanceof TimeoutError) {
        this.logger.fatal(
          { timeout: config.GET_RECEIPT_TIMEOUT },
          `Getting receipt ${task.transactionHash} reaches timeout.`,
        )
        Sentry.captureMessage(
          `Get receipt ${task.transactionHash} exceeds timeout ${config.GET_RECEIPT_TIMEOUT}ms.`,
          Sentry.Severity.Warning
        )
        return Promise.resolve(ReceiptResult.timeout)
      }

      throw e
    }

    let result = ReceiptResult.failed
    if (receipt === null) {
      // Getting receipt
      if (await this.checkBlockAdvencedK(task.sentBlock, config.MAX_WAIT_RECEIPT_BLOCK)) {
        this.logger.error(
          {
            tx: task.transactionHash,
            sentBlock: task.sentBlock,
            K: config.MAX_WAIT_RECEIPT_BLOCK,
          },
          `exceed maximum wait receipt block`,
        )
        await this.resendEvent(task, task.nonce, enqueueSender)
        result = ReceiptResult.null
      } else {
        result = ReceiptResult.waittingReceipt
      }
    } else if (receipt!.status) {
      // Get a success receipt
      this.logger.info({ receipt }, `get receipt success, wait ${config.blockConfirmation} block for confirmation`)
      if (await this.checkBlockAdvencedK(receipt!.blockNumber, config.blockConfirmation)) {
        result = ReceiptResult.success
      } else {
        result = ReceiptResult.waittingK
      }
    } else if (!receipt!.status) {
      // Get a failed receipt
      this.logger.info({ receipt }, `get receipt returns failed status`)
      // We have got the receipt, resend task with undefined nonce.
      await this.resendEvent(task, undefined, enqueueSender)
      result = ReceiptResult.failed
    }

    this.logger.info(`receiptor.run('${task.transactionHash}') returns: '${result}'`)
    return Promise.resolve(result)
  }
}
