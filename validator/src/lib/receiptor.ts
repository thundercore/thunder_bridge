import Web3 from 'web3'
import { ReceiptTask, EventTask } from './types'
import config = require('../../config')
import { TransactionReceipt } from 'web3-core'
import rootLogger = require('../services/logger')

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
  waittingK = 'waitting K block',
  waittingReceipt = 'waitting tx receipt',
}

type sendToQueue = (task: EventTask) => Promise<void>

class TimeoutError extends Error {}

export class Receiptor {
  web3: ReceiptorWeb3
  logger: any

  constructor(id: string, web3: ReceiptorWeb3) {
    this.web3 = web3
    this.logger = rootLogger.child({
      receiptId: id
    })
  }

  async resendEvent(task: ReceiptTask, sendToQueue: sendToQueue): Promise<void> {
    let newTask: EventTask = {
      ...task.eventTask,
      nonce: task.nonce,
      retries: task.retries? task.retries+1 : 1,
      timestamp: task.timestamp
    }
    this.logger.debug({...newTask}, 'resend event task')
    return sendToQueue(newTask)
  }

  async checkBlockAdvencedK(block: number, k: number): Promise<boolean> {
    const currBlock = await this.web3.getCurrentBlock()
    this.logger.debug({block, currBlock, k}, `check if currBlock - block >= k`)
    // TODO: K is >= or >?
    return Promise.resolve(currBlock - block >= k)
  }

  async getReceipt(task: ReceiptTask): Promise<TransactionReceipt|null> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(async() => {
        this.logger.info({timeout: config.GET_RECEIPT_TIMEOUT},
           `Getting receipt ${task.transactionHash} reaches timeout.`)
        reject(new TimeoutError())
      }, config.GET_RECEIPT_TIMEOUT)

      this.logger.info({timeout: config.GET_RECEIPT_TIMEOUT, tx: task.transactionHash},
        'Try to get receipt.')
      resolve(await this.web3.getTransactionReceipt(task.transactionHash))
      clearTimeout(timer)
    })
  }

  async run(task: ReceiptTask, sendToQueue: sendToQueue): Promise<ReceiptResult> {
    let receipt: TransactionReceipt|null
    console.debug(task, `init receipter task`)
    try {
      receipt = await this.getReceipt(task)
    } catch (e) {
      this.logger.info({e}, `Getting receipt failed`)
      return Promise.resolve(ReceiptResult.timeout)
    }

    let result = ReceiptResult.failed
    if (receipt === null) {
      // Getting receipt
      if (await this.checkBlockAdvencedK(task.sentBlock, config.MAX_WAIT_RECEIPT_BLOCK)) {
        this.logger.error({
          tx: task.transactionHash,
          sentBlock: task.sentBlock,
          K: config.MAX_WAIT_RECEIPT_BLOCK
        }, `exceed maximum wait receipt block`)
        await this.resendEvent(task, sendToQueue)
        result = ReceiptResult.null
      } else {
        result = ReceiptResult.waittingReceipt
      }

    } else if (receipt!.status) {
      // Get a success receipt
      this.logger.info({ receipt }, `get receipt success, wait ${config.BLOCK_CONFIRMATION} block for confirmation`)
      if (await this.checkBlockAdvencedK(receipt!.blockNumber, config.BLOCK_CONFIRMATION)) {
        result = ReceiptResult.success
      } else {
        result = ReceiptResult.waittingK
      }

    } else if (!receipt!.status) {
      // Get a failed receipt
      this.logger.info({ receipt }, `get receipt returns failed status`)
      await this.resendEvent(task, sendToQueue)
      result = ReceiptResult.failed
    }

    this.logger.info(`receiptor.run('${task.transactionHash}') returns: '${result}'`)
    return Promise.resolve(result)
  }
}