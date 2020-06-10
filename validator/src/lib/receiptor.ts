import Web3 from 'web3'
import { TransactionReceipt } from 'web3-core'
import { ReceiptTask, EventTask } from './types'

import config = require('../../config')
import rootLogger = require('../services/logger')
import { Contract } from 'web3-eth-contract'

interface ReceiptorWeb3 {
  getCurrentBlock: () => Promise<number>
  getTransactionReceipt: (transactionHash: string) => Promise<TransactionReceipt>
  getRequiredBlockConfirmations: () => Promise<number>
}

export class ReceiptorWeb3Impl implements ReceiptorWeb3 {
  web3: Web3
  bridgeContract: Contract

  constructor(web3: Web3, bridgeContract: Contract) {
    this.web3 = web3
    this.bridgeContract = bridgeContract
  }

  async getCurrentBlock(): Promise<number> {
    return this.web3.eth.getBlockNumber()
  }

  async getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    return this.web3.eth.getTransactionReceipt(transactionHash)
  }

  async getRequiredBlockConfirmations(): Promise<number> {
    let requiredBlockConfirmations: number
    try {
      const contractAddress = this.bridgeContract.options.address
      rootLogger.debug({ contractAddress }, 'Getting required block confirmations')
      requiredBlockConfirmations = await this.bridgeContract.methods.requiredBlockConfirmations().call()
      rootLogger.debug({ contractAddress, requiredBlockConfirmations }, 'Required block confirmations obtained')
    } catch (e) {
      throw new Error(`Required block confirmations cannot be obtained`)
    }
    return requiredBlockConfirmations
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
      receiptId: id,
    })
  }

  async resendEvent(task: ReceiptTask, nonce: number|undefined, sendToQueue: sendToQueue): Promise<void> {
    const newTask: EventTask = {
      ...task.eventTask,
      nonce: nonce,
      retries: task.retries ? task.retries + 1 : 1,
      timestamp: task.timestamp,
    }
    this.logger.debug({ ...newTask }, 'resend event task')
    return sendToQueue(newTask)
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
        this.logger.info(
          { timeout: config.GET_RECEIPT_TIMEOUT },
          `Getting receipt ${task.transactionHash} reaches timeout.`,
        )
        reject(new TimeoutError())
      }, config.GET_RECEIPT_TIMEOUT)

      this.logger.info({ timeout: config.GET_RECEIPT_TIMEOUT, tx: task.transactionHash }, 'Try to get receipt.')
      resolve(await this.web3.getTransactionReceipt(task.transactionHash))
      clearTimeout(timer)
    })
  }

  async run(task: ReceiptTask, sendToQueue: sendToQueue): Promise<ReceiptResult> {
    let receipt: TransactionReceipt | null
    try {
      receipt = await this.getReceipt(task)
    } catch (e) {
      this.logger.info({ e }, `Getting receipt failed`)
      return Promise.resolve(ReceiptResult.timeout)
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
        await this.resendEvent(task, task.nonce, sendToQueue)
        result = ReceiptResult.null
      } else {
        result = ReceiptResult.waittingReceipt
      }
    } else if (receipt!.status) {
      // Get a success receipt
      const requiredBlockConfirmations = await this.web3.getRequiredBlockConfirmations()
      this.logger.info({ receipt }, `get receipt success, wait ${requiredBlockConfirmations} block for confirmation`)
      if (await this.checkBlockAdvencedK(receipt!.blockNumber, requiredBlockConfirmations)) {
        result = ReceiptResult.success
      } else {
        result = ReceiptResult.waittingK
      }
    } else if (!receipt!.status) {
      // Get a failed receipt
      this.logger.info({ receipt }, `get receipt returns failed status`)
      // We have got the receipt, resend task with undefined nonce.
      await this.resendEvent(task, undefined, sendToQueue)
      result = ReceiptResult.failed
    }

    this.logger.info(`receiptor.run('${task.transactionHash}') returns: '${result}'`)
    return Promise.resolve(result)
  }
}
