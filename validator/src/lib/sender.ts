import BN from 'bn.js'
import Web3 from 'web3'
import rootLogger = require("../services/logger")
import { EventTask, TxInfo, ReceiptTask, isRetryTask, enqueueReceiptor } from './types'
import { Locker } from './locker'
import { Cache } from './storage'
import { TransactionConfig, HttpProvider } from 'web3-core'
import { processEvents } from '../events'
import { addExtraGas } from '../utils/utils'
import { toBN, toWei } from 'web3-utils'
import { BigNumber } from 'bignumber.js'
import { JsonRpcResponse } from 'web3-core-helpers'
import config from '../../config'

import * as Sentry from '@sentry/node';

export interface SenderWeb3 {
  getPrice: (timestamp: number) => Promise<number>
  getNonce: () => Promise<number>
  getBalance: () => Promise<string>
  getCurrentBlock: () => Promise<number>
  sendTransaction: (nonce: number, gasLimit: BigNumber, amount: BN, txinfo: TxInfo) => Promise<string>
  processEvents: (task: EventTask) => Promise<TxInfo[]>
  sendToSelf: (nonce: number) => Promise<string>
}

export interface Validator {
  address: string
  privateKey: string
}

class SubmitTxError extends Error {
  txHash: string;

  constructor(txHash: string, origError: Error) {
    super(origError.message)
    this.name = 'SubmitTxError'
    this.txHash = txHash;
  }
}

export class SenderWeb3Impl implements SenderWeb3 {
  name: string
  chainId: number
  validator: Validator
  web3: Web3
  gasPriceService: any
  logger: any

  constructor(name: string, chainId: number, validator: Validator, web3: Web3, gasPriceService: any) {
    this.name = name
    this.chainId = chainId
    this.validator = validator
    this.web3 = web3
    this.gasPriceService = gasPriceService

    this.logger = rootLogger.child({
      senderId: name
    })
  }

  async getPrice(timestamp: number): Promise<number> {
    return this.gasPriceService.getPrice(timestamp)
  }

  async getNonce(): Promise<number> {
    try {
      this.logger.debug({ validatorAddr: this.validator.address }, 'Getting transaction count')
      const transactionCount = await this.web3.eth.getTransactionCount(this.validator.address)
      this.logger.debug({ validatorAddr: this.validator.address, transactionCount }, 'Transaction count obtained')
      return Promise.resolve(transactionCount)
    } catch (e) {
      throw new Error(`Nonce cannot be obtained: ${e}`)
    }
  }

  async submitTx(txConfig: TransactionConfig): Promise<string> {
    const method = 'eth_sendRawTransaction'
    const provider = <HttpProvider>this.web3.currentProvider

    const signedTx = await this.web3.eth.accounts.signTransaction(txConfig, `0x${this.validator.privateKey}`)
    if (signedTx.transactionHash === undefined) {
      return new Promise((_, reject) => {
        reject(new Error('sendSignedTransactoin: serialiedTx.transactionHash is undefined'))
      })
    }
    const txHash = signedTx.transactionHash!

    Sentry.addBreadcrumb({
      category: 'submitTx',
      message: `submitTx with following config`,
      data: txConfig,
      level: Sentry.Severity.Debug
    })

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Send ${method} timeout`))
      }, 2000)

      provider.send({
        jsonrpc: '2.0',
        method: method,
        params: [ signedTx.rawTransaction ],
        id: Math.floor(Math.random() * 100) + 1
      }, (error: Error | null, result?: JsonRpcResponse) => {
        clearTimeout(timer)

        if (error) {
          reject(new SubmitTxError(txHash, error!))
        } else {
          if (result?.error) {
            reject(new SubmitTxError(txHash, (<Error><unknown>result.error)))
          } else {
            resolve((<JsonRpcResponse>result).result)
          }
        }
      })
    })
  }

  async sendToSelf(nonce: number): Promise<string> {
    const txConfig: TransactionConfig = {
      nonce,
      chainId: this.chainId,
      to: this.validator.address,
      value: toWei(toBN('0')),
      gas: 21000 * 2,
      gasPrice: (await this.getPrice(Date.now())).toString(),
    }

    this.logger.debug(txConfig, 'Send transaction to self')
    return this.submitTx(txConfig)
  }

  async sendTransaction(nonce: number, gasLimit: BigNumber, amount: BN, txinfo: TxInfo): Promise<string> {
    const timestamp = txinfo.eventTask.timestamp?
      txinfo.eventTask.timestamp:
      Math.floor(Date.now())

    const txConfig: TransactionConfig = {
      nonce,
      chainId: this.chainId,
      from: this.validator.address,
      to: txinfo.to,
      data: txinfo.data,
      value: toWei(amount),
      gas: gasLimit.toString(),
      gasPrice: (await this.getPrice(timestamp)).toString(),
    }

    this.logger.debug({txConfig}, 'Send transaction by txinfo')
    return this.submitTx(txConfig)
  }

  async getBalance(): Promise<string> {
    return this.web3.eth.getBalance(this.validator.address)
  }

  async processEvents(task: EventTask): Promise<TxInfo[]> {
    return processEvents(task, this.validator)
  }

  async getCurrentBlock(): Promise<number> {
    return this.web3.eth.getBlockNumber()
  }
}

namespace SendTxError {
  export function isNonceTooLowError(e: Error): boolean {
    return (
      e.message.includes('Transaction nonce is too low') ||
      e.message.includes('nonce too low') ||
      e.message.includes('transaction with same nonce in the queue') ||
      e.message.includes("the tx doesn't have the correct nonce") // truffle
    )
  }

  export function isBlockGasLimitExceededError(e: Error): boolean {
    return (
      e.message.includes('exceeds block gas limit') || // truffle
      e.message.includes('Exceeds block gas limit') // geth
    )
  }

  export function isTxWasImportedError(e: Error): boolean {
    return e.message.includes('Transaction with the same hash was already imported') ||
      e.message.includes('known transaction') // Pala
  }

  export function isInsufficientFundError(e: Error): boolean {
    return (
      e.message.includes('Insufficient funds') ||
      e.message.includes('insufficient funds') ||
      e.message.includes("doesn't have enough funds to send tx")
    )
  }

  export function isTimeoutError(e: Error): boolean {
    return e.message.includes('timeout')
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
  timeout = 'timeout',
  sendDummyTxToFillNonce = 'sendDummyTxToFillNonce',
}


export class Sender {
  name: string
  web3: SenderWeb3
  locker: Locker
  cache?: Cache
  noncelock: string
  nonceKey: string

  logger: any

  constructor(name: string, web3: SenderWeb3, locker: Locker, cache?: Cache) {
    this.name = name
    this.web3 = web3
    this.locker = locker
    this.cache = cache

    this.noncelock = `lock:${this.name}:nonce`
    this.nonceKey = `${this.name}:nonce`

    this.logger = rootLogger.child({
      senderId: name
    })
  }

  async updateNonce(newNonce: number): Promise<void> {
    if (this.cache) {
      const oldNonce = await this.cache.get(this.nonceKey)
      this.logger.debug({oldNonce, newNonce}, 'Update cache nonce')
      if (!oldNonce || Number(oldNonce) < newNonce) {
        this.cache.set(this.nonceKey, newNonce.toString())
      }
    }
    return Promise.resolve()
  }

  async readNonce(forceUpdate: boolean): Promise<number> {
    if (this.cache && !forceUpdate) {
      try {
        const nonce = await this.cache.get(this.nonceKey)
        if (nonce || nonce === 0) {
          this.logger.debug({ nonce }, `Nonce found in the DB, key: ${this.nonceKey}`)
          return Promise.resolve(Number(nonce))
        }
        this.logger.debug(`Nonce not found in the DB, key: ${this.nonceKey}`)
      } catch (e) {
        this.logger.error(`failed to read nonce from cache, force update nonce.`)
      }
    }
    return this.web3.getNonce()
  }

  async processEventTask(task: EventTask): Promise<TxInfo|null> {
    let txInfos: TxInfo[]
    try {
      txInfos = await this.web3.processEvents(task)
    } catch(e) {
      this.logger.fatal({task}, 'failed to process events.')
      Sentry.addBreadcrumb({
        category: 'processEvents',
        message: `failed to process events`,
        level: Sentry.Severity.Info,
        data: {
          eventType: task.eventType,
          transactionReference: task.event.transactionHash
        }
      })
      Sentry.captureException(e)
      throw e
    }

    if (txInfos.length === 0 ) {
      return Promise.resolve(null)
    }
    let txInfo = txInfos[0]
    txInfo.eventTask = task
    return Promise.resolve(txInfos[0])
  }

  async newReceiptTask(task: EventTask, txHash: string, nonce: number): Promise<ReceiptTask> {
    const receiptTask: ReceiptTask = {
      eventTask: task,
      timestamp: Date.now() / 1000,
      nonce: nonce,
      transactionHash: txHash,
      sentBlock: await this.web3.getCurrentBlock(),
      retries: task.retries
    }
    return Promise.resolve(receiptTask)
  }

  async sendToSelf(task: EventTask, logger: any): Promise<string|null> {
    let txHash: string
    console.log(`send a transaction to fill nonce: ${task}`)

    try {
      Sentry.addBreadcrumb({
        category: 'submitTx',
        message: `send a transaction to fill nonce: ${task.nonce!}`,
        level: Sentry.Severity.Debug,
        data: {
          eventType: task.eventType,
          transactionReference: task.event.transactionHash
        }
      })

      txHash = await this.web3.sendToSelf(task.nonce!)
      logger.info({txHash, nonce: task.nonce!}, 'Event was ignored, send a transaction to fill nonce.')

    } catch(e) {
      if (SendTxError.isNonceTooLowError(e)) {
        // If the nonce is too low, we don't need to fill this nonce.
        logger.info(`sendToSelf returns nonce too low error. (skip)`)
        return null
      } else if (SendTxError.isTxWasImportedError(e)) {
        // If the tx was imported, ignore this error and add to receiptor queue.
        logger.info({txHash: e.txHash}, `sendToSelf tx was imported. (skip)`)
        return e.txHash
      } else {
        Sentry.captureException(e)
        logger.error(e, `sendToSelf raised unknown error`)
        throw e
      }
    }

    return txHash
  }

  async run(task: EventTask, enqueueReceiptor: enqueueReceiptor): Promise<SendResult> {
    let result: SendResult

    const logger = this.logger.child({eventTx: task.event.transactionHash})
    logger.info(`Start to process ${task.eventType} event.`)

    const txInfo = await this.processEventTask(task)
    if (txInfo === null) {
      // If CurrNonce <= retryTask.nonce, we need to fill this nonce
      // even if the task was skipped by estimateGas.
      if (isRetryTask(task) && (await this.readNonce(true)) <= task.nonce!) {
        const txHash = await this.sendToSelf(task, logger)
        if (txHash !== null) {
          const receiptTask = await this.newReceiptTask(task, txHash!, task.nonce!)
          await enqueueReceiptor(receiptTask)
          result = SendResult.sendDummyTxToFillNonce
        } else {
          result = SendResult.skipped
        }
      } else {
        result = SendResult.skipped
      }

    } else {
      const lock = await this.locker.lock(this.noncelock)
      try {
        logger.debug(`Acquiring lock: ${this.noncelock}`)
        result = await this.sendTx(txInfo, enqueueReceiptor)
      } finally {
        logger.debug('Releasing lock')
        await lock.unlock()
      }
    }

    logger.debug({result}, `End of process ${task.eventType} event`)
    return Promise.resolve(result)
  }

  async sendTx(txinfo: TxInfo, enqueueReceiptor: enqueueReceiptor): Promise<SendResult> {
    const logger = this.logger.child({eventTx: txinfo.transactionReference})

    let nonce: number
    if (isRetryTask(txinfo.eventTask) && txinfo.eventTask.nonce! >= (await this.readNonce(true))) {
      // Use retryTask.nonce iff currNonce <= retryTask.nonce or currNonce.
      nonce = txinfo.eventTask.nonce!
      logger.debug(`Use retry task nonce: ${nonce}`)
    } else {
      nonce = await this.readNonce(false)
      logger.debug(`Read nonce: ${nonce}`)
    }

    let result = SendResult.failed
    const gasLimit = addExtraGas(txinfo.gasEstimate, config.EXTRA_GAS_PERCENTAGE)

    const enqueueReceiptTask = async (txHash: string, nonce: number) => {
      const receiptTask = await this.newReceiptTask(txinfo.eventTask, txHash, nonce)
      logger.debug({receiptTask}, 'enqueue receipt task')
      await enqueueReceiptor(receiptTask)
    }

    try {
      logger.info(`Sending transaction with nonce ${nonce}`)
      const txHash = await this.web3.sendTransaction(nonce, gasLimit, toBN('0'), txinfo)

      logger.info(`sendTransaction returns receiptTx: ${txHash}`)

      await enqueueReceiptTask(txHash, nonce)
      result = SendResult.success
      nonce++

    } catch (e) {
      let txHash: string = ''
      logger.error({ txHash, error: e.message }, `Failed to sendTx: ${e.message}`,)

      if (SendTxError.isTxWasImportedError(e)) {
        if (e instanceof SubmitTxError) {
          await enqueueReceiptTask(e.txHash, nonce)
        }
        logger.warn({txHash}, `tx was already imported.`)
        result = SendResult.txImported

      } else if (SendTxError.isBlockGasLimitExceededError(e)) {
        logger.warn(`block gas limit exceeded. (skiped)`)
        result = SendResult.blockGasLimitExceeded

      } else if (SendTxError.isInsufficientFundError(e)) {
        result = SendResult.insufficientFunds

      } else if (SendTxError.isNonceTooLowError(e)) {
        logger.error(`nonce is too low. Force update nonce.`)
        nonce = await this.readNonce(true)
        result = SendResult.nonceTooLow

      } else if (SendTxError.isTimeoutError(e)) {
        logger.error(`sendTx reaches timeout`)
        Sentry.captureMessage(`sendTx exceeds timeout`)
        result = SendResult.timeout

      } else {
        Sentry.captureException(e)
        logger.error(e, `Send transaction raised unknown error`)
      }
    }

    logger.debug(`Updating nonce ${nonce}`)
    await this.updateNonce(nonce)

    logger.info(`Task finished with result: ${result}`)

    return Promise.resolve(result)
  } // end of main
}
