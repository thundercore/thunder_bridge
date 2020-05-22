import Web3 from 'web3'
import { ReceiptTask, EventTask } from './types'
import config = require('../../config')
import { TransactionReceipt } from 'web3-core'
import logger = require('../services/logger')
import { resolve } from 'dns'

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
  skipped,
  success,
  null,
  timeout,
  failed,
}

type sendToQueue = (task: EventTask) => Promise<void>


export class Receiptor {
  web3: ReceiptorWeb3

  constructor(web3: ReceiptorWeb3) {
    this.web3 = web3
  }

  async resendEvent(task: ReceiptTask, sendToQueue: sendToQueue): Promise<void> {
    let newTask: EventTask = {
      ...task.eventTask,
      nonce: task.nonce,
      retries: task.retries? task.retries+1 : 1
    }
    logger.debug({...newTask}, 'resend event task')
    return sendToQueue(newTask)
  }

  async getReceipt(task: ReceiptTask): Promise<TransactionReceipt|null> {
    return new Promise(async (resolve, reject) => {
      setTimeout(reject, config.GET_RECEIPT_TIMEOUT)
      logger.info({timeout: config.GET_RECEIPT_TIMEOUT, tx: task.transactionHash},
        'Try to get receipt.')
      resolve(await this.web3.getTransactionReceipt(task.transactionHash))
    })
  }

  async run(task: ReceiptTask, sendToQueue: sendToQueue): Promise<ReceiptResult> {
    const currBlock = await this.web3.getCurrentBlock()
    // Wait K block for confirmation. Skip if the increasing of block number is less then K.
    if (currBlock < task.blockNumber + config.BLOCK_CONFIRMATION) {
      logger.info({blockNumber: task.blockNumber, currentBlockNumber: currBlock, K: config.BLOCK_CONFIRMATION},
        'task was skipped due to current block number < receipt.blocknumber + k')
      return Promise.resolve(ReceiptResult.skipped)
    }

    let result = ReceiptResult.failed
    let tx: TransactionReceipt|null
    try {
      tx = await this.getReceipt(task)
    } catch (e) {
      logger.info({timeout: config.GET_RECEIPT_TIMEOUT},
         `Getting receipt ${task.transactionHash} reaches timeout.`)
      await this.resendEvent(task, sendToQueue)
      return Promise.resolve(ReceiptResult.timeout)
    }

    switch (true) {
      case tx === null:
        logger.error({tx: task.transactionHash}, `get receipt returns null`)
        await this.resendEvent(task, sendToQueue)
        result = ReceiptResult.null
        break

      case tx && tx.status:
        logger.info({tx}, `get receipt returns success status`)
        result = ReceiptResult.success
        break

      case tx && !tx.status:
        logger.info({tx}, `get receipt returns failed status`)
        await this.resendEvent(task, sendToQueue)
        result = ReceiptResult.failed
        break
    }

    return Promise.resolve(result)
  }
}