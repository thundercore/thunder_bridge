import BN from 'bn.js'
import Web3 from 'web3'
import logger = require("../services/logger")
import { EXTRA_GAS_PERCENTAGE } from '../utils/constants'
import { EventTask, TxInfo, ReceiptTask } from './types'
import { Locker } from './locker'
import { Cache } from './storage'
import { TransactionConfig, TransactionReceipt } from 'web3-core'
import { processEvents } from '../events'
import { addExtraGas } from '../utils/utils'
import { toBN, toWei } from 'web3-utils'
import { BigNumber } from 'bignumber.js'

export interface SenderWeb3 {
  getPrice: (timestamp: number) => Promise<number>
  getNonce: () => Promise<number>
  getBalance: () => Promise<string>
  sendTx: (nonce: number, gasLimit: BigNumber, amount: BN, txinfo: TxInfo) => Promise<TransactionReceipt>
  processEvents: (task: EventTask) => Promise<TxInfo[]>
}

export interface Validator {
  address: string
  privateKey: string
}

export class SenderWeb3Impl implements SenderWeb3 {
  id: string
  chainId: number
  validator: Validator
  web3: Web3
  gasPriceService: any

  constructor(id: string, chainId: number, validator: Validator, web3: Web3, gasPriceService: any) {
    this.id = id
    this.chainId = chainId
    this.validator = validator
    this.web3 = web3
    this.gasPriceService = gasPriceService
  }

  async getPrice(timestamp: number): Promise<number> {
    return this.gasPriceService.getPrice(timestamp)
  }

  async getNonce(): Promise<number> {
    try {
      logger.debug({ validatorAddr: this.validator.address }, 'Getting transaction count')
      const transactionCount = await this.web3.eth.getTransactionCount(this.validator.address)
      logger.debug({ validatorAddr: this.validator.address, transactionCount }, 'Transaction count obtained')
      return Promise.resolve(transactionCount)
    } catch (e) {
      throw new Error(`Nonce cannot be obtained`)
    }
  }

  async sendTx(nonce: number, gasLimit: BigNumber, amount: BN, txinfo: TxInfo): Promise<TransactionReceipt> {
    const txConfig: TransactionConfig = {
      nonce,
      chainId: this.chainId,
      to: txinfo.to,
      data: txinfo.data,
      value: toWei(amount),
      gas: gasLimit.toString(),
      gasPrice: (await this.getPrice(Math.floor(Date.now() / 1000))).toString(10),
    }

    const signedTx = await this.web3.eth.accounts.signTransaction(txConfig, `0x${this.validator.privateKey}`)
    return this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!)
  }

  async getBalance(): Promise<string> {
    return this.web3.eth.getBalance(this.validator.address)
  }

  async processEvents(task: EventTask): Promise<TxInfo[]> {
    return processEvents(task, this.validator)
  }
}

class SendTxError {
  static isNonceTooLowError(e: Error): boolean {
    return (
      e.message.includes('Transaction nonce is too low') ||
      e.message.includes('nonce too low') ||
      e.message.includes('transaction with same nonce in the queue') ||
      e.message.includes("the tx doesn't have the correct nonce") // truffle
    )
  }

  static isBlockGasLimitExceededError(e: Error): boolean {
    return (
      e.message.includes('exceeds block gas limit') || e.message.includes('Exceeds block gas limit') // geth
    ) // truffle
  }

  static isTxWasImportedError(e: Error): boolean {
    return e.message.includes('Transaction with the same hash was already imported')
  }

  static isInsufficientFoundError(e: Error): boolean {
    return e.message.includes('Insufficient funds')
  }
}

export enum SendResult {
  success = 'success',
  failed = 'failed',
  txImported = 'txImported',
  blockGasLimitExceeded = 'blockGasLimitExceeded',
  insufficientFunds = 'insufficientFunds',
  nonceTooLow = 'nonceTooLow',
  skipped = 'skipped',
}


type sendToQueue = (task: ReceiptTask) => Promise<void>;

export class Sender {
  id: string
  web3: SenderWeb3
  locker: Locker
  cache?: Cache
  noncelock: string
  nonceKey: string

  constructor(id: string, web3: SenderWeb3, locker: Locker, cache?: Cache) {
    this.id = id
    this.web3 = web3
    this.locker = locker
    this.cache = cache

    this.noncelock = `lock:${this.id}:nonce`
    this.nonceKey = `${this.id}:nonce`
  }

  async updateNonce(nonce: number): Promise<void> {
    if (this.cache) {
      this.cache.set(this.nonceKey, nonce.toString())
    }
    return Promise.resolve()
  }

  async readNonce(forceUpdate: boolean): Promise<number> {
    logger.info(this.cache, forceUpdate)
    if (this.cache && !forceUpdate) {
      try {
        const nonce = await this.cache.get(this.nonceKey)
        if (nonce !== undefined) {
          logger.debug({ nonce }, `Nonce found in the DB, key: ${this.nonceKey}`)
          return Promise.resolve(Number(nonce))
        }
        logger.debug(`Nonce not found in the DB, key: ${this.nonceKey}`)
      } catch (e) {
        logger.error(`failed to read nonce from cache, force update nonce.`)
      }
    }
    logger.info(`this.web3.getNonce()`)
    return this.web3.getNonce()
  }

  async EventToTxInfo(task: EventTask): Promise<TxInfo|null> {
    let txInfos = await this.web3.processEvents(task)
    if (txInfos.length === 0 ) {
      return Promise.resolve(null)
    }
    let txInfo = txInfos[0]
    txInfo.eventTask = task
    return Promise.resolve(txInfos[0])
  }

  async run(task: EventTask, sendToQueue: sendToQueue): Promise<SendResult> {
    let result: SendResult

    logger.info(`Process ${task.eventType} event '${task.event.transactionHash}'`)
    const txInfo = await this.EventToTxInfo(task)
    if (txInfo === null) {
      result = SendResult.skipped
    } else {
      result = await this.sendTx(txInfo, sendToQueue)
    }

    logger.debug({tx: task.event.transactionHash, result}, "run task finished")
    return Promise.resolve(result)
  }

  async sendTx(txinfo: TxInfo, sendToQueue: sendToQueue): Promise<SendResult> {
    logger.debug(`Acquiring lock: ${this.noncelock}`)
    const lock = await this.locker.lock(this.noncelock)
    logger.debug('Lock acquired')

    let nonce: number
    try {
      nonce = await this.readNonce(false)
      logger.debug(`read nonce: ${nonce}`)
    } catch (e) {
      logger.error(`Failed to read nonce.`)
      return Promise.resolve(SendResult.failed)
    }

    let result = SendResult.failed
    const gasLimit = addExtraGas(txinfo.gasEstimate, EXTRA_GAS_PERCENTAGE)
    try {
      logger.info(`Sending transaction with nonce ${nonce}`)
      const receipt = await this.web3.sendTx(nonce, gasLimit, toBN('0'), txinfo)

      nonce += 1

      if (receipt.status) {
        logger.info(
          { receipt },
          `Tx generated ${receipt.transactionHash} for event Tx ${txinfo.transactionReference}`
        )

        let receiptTask: ReceiptTask = {
          eventTask: txinfo.eventTask,
          timestamp: Date.now(),
          nonce: nonce,
          receipt: receipt
        }
        await sendToQueue(receiptTask)
        console.log(receiptTask)

        result = SendResult.success
      } else {
        // FIXME: what can we do here?
        logger.error({receipt}, `transaction was reverted by EVM`)
      }

    } catch (e) {
      logger.error(
        { eventTransactionHash: txinfo.transactionReference, error: e.message },
        `Failed to send event Tx ${txinfo.transactionReference}: ${e.message}`,
      )

      switch (true) {
        case SendTxError.isTxWasImportedError(e):
          logger.info(`tx ${txinfo.transactionReference} was already imported. (skiped)`)
          result = SendResult.txImported
          break

        case SendTxError.isBlockGasLimitExceededError(e):
          logger.info(`tx ${txinfo.transactionReference} block gas limit exceeded.(skiped)`)
          result = SendResult.blockGasLimitExceeded
          break

        case SendTxError.isInsufficientFoundError(e):
          result = SendResult.insufficientFunds
          break

        case SendTxError.isNonceTooLowError(e):
          logger.info(`tx ${txinfo.transactionReference} nonce is too low. Force update nonce.`)
          nonce = await this.readNonce(true)
          result = SendResult.nonceTooLow
          break

        default:
          logger.error(`Unknown error, tx: ${txinfo.transactionReference}`)
          break
      }
    }

    logger.debug(`Updating nonce ${nonce}`)
    await this.updateNonce(nonce)

    logger.debug('Releasing lock')
    await lock.unlock()

    logger.info(`Finished sendTx with result: ${result}`)

    return Promise.resolve(result)
  } // end of main
}
