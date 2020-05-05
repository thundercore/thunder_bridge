import BN from 'bn.js'
import Web3 from 'web3'
import logger from "../services/logger"
import promiseRetry from 'promise-retry'
import { EXTRA_GAS_PERCENTAGE } from '../utils/constants'
import { EventTask, TxInfo } from './types'
import { Locker } from './locker'
import { Cache } from './storage'
import { Queue } from './queue'
import { TransactionConfig, TransactionReceipt } from 'web3-core'
import { getValidatorKey } from '../../config/private-keys.config'
import { processEvents } from '../events'
import { addExtraGas } from '../utils/utils'
import { toWei, toBN } from 'web3-utils'

export interface SenderWeb3 {
  getPrice: () => number
  getNonce: () => Promise<number>
  getBalance: () => Promise<string>
  sendTx: (nonce: number, gasLimit: number, amount: BN, txinfo: TxInfo) => Promise<TransactionReceipt>
}

export class SenderWeb3Impl implements SenderWeb3 {
  id: string
  chainId: number
  validatorAddress: string
  web3: Web3
  gasPriceService: any

  constructor(id: string, chainId: number, validatorAddress: string, web3: Web3, gasPriceService: any){
    this.id = id
    this.chainId = chainId
    this.validatorAddress = validatorAddress
    this.web3 = web3
    this.gasPriceService = gasPriceService
  }

  getPrice(): number {
    return this.gasPriceService.getPrice()
  }

  async getNonce(): Promise<number> {
    try {
      logger.debug({ validatorAddr: this.validatorAddress }, 'Getting transaction count')
      const transactionCount = await this.web3.eth.getTransactionCount(this.validatorAddress)
      logger.debug({ validatorAddr: this.validatorAddress, transactionCount }, 'Transaction count obtained')
      return Promise.resolve(transactionCount)
    } catch (e) {
      throw new Error(`Nonce cannot be obtained`)
    }
  }

  async sendTx(nonce: number, gasLimit: number, amount: BN, txinfo: TxInfo): Promise<TransactionReceipt> {
    let txConfig: TransactionConfig = {
      nonce: nonce,
      chainId: this.chainId,
      to: txinfo.to,
      data: txinfo.data,
      value: toWei(amount),
      gas: gasLimit,
      gasPrice: this.getPrice().toString(10),
    }

    let privateKey = await getValidatorKey()
    let signedTx = await this.web3.eth.accounts.signTransaction(txConfig, privateKey)
    return this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
  }

  getBalance(): Promise<string> {
    return this.web3.eth.getBalance(this.validatorAddress)
  }
}

class SendTxError {
  static isNonceTooLowError(e: Error): boolean {
    return (
      e.message.includes('Transaction nonce is too low') ||
      e.message.includes('nonce too low') ||
      e.message.includes('transaction with same nonce in the queue')
    )
  }

  static isBlockGasLimitExceededError(e: Error): boolean {
    return e.message.includes('exceeds block gas limit') // geth
  }

  static isTxWasImportedError(e: Error): boolean {
    return e.message.includes('Transaction with the same hash was already imported')
  }

  static isInsufficientFoundError(e: Error): boolean {
    return e.message.includes('Insufficient funds')
  }
}

enum SendResult {
  success = "success",
  failed = "failed",
  insufficientFunds = "insufficientFunds"
}


export class Sender {
  id: string
  queue: Queue<EventTask>
  web3: SenderWeb3
  locker: Locker
  ttl: number
  cache?: Cache
  noncelock: string
  nonceKey: string

  constructor(id: string, queue: Queue<EventTask>, web3: SenderWeb3, locker: Locker, ttl: number, cache?: Cache){
    this.id = id
    this.queue = queue
    this.web3 = web3
    this.locker = locker
    this.ttl = ttl
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
        let nonce = await this.cache.get(this.nonceKey)
        if (nonce) {
          logger.debug({ nonce }, `Nonce found in the DB, key: ${this.nonceKey}`)
          return Promise.resolve(Number(nonce))
        } else {
          logger.debug(`Nonce not found in the DB, key: ${this.nonceKey}`)
        }
      } catch (e) {
        logger.error(`failed to read nonce from cache, force update nonce.`)
      }
    }
    logger.info(`this.web3.getNonce()`)
    return this.web3.getNonce()
  }

  async waitForFunds(minimumBalance: BN) {
    promiseRetry(
      async retry => {
        logger.debug('Getting balance of validator account')
        const newBalance = toBN(await this.web3.getBalance())
        if (newBalance.gte(minimumBalance)) {
          logger.info(
            { balance: newBalance, minimumBalance },
            'Validator has minimum necessary balance'
          )
        } else {
          logger.debug(
            { balance: newBalance, minimumBalance },
            'Balance of validator is still less than the minimum'
          )
          retry(null)
        }
      },
      {
        forever: true,
        factor: 1
      }
    )
  }

  async EventToTxInfo(task: EventTask): Promise<TxInfo> {
    return await processEvents(task.eventType, task.event)[0]
  }

  async run(task: EventTask) {
    logger.info(`Process ${task.eventType} event '${task.event.transactionHash}'`)
    let txInfo = await this.EventToTxInfo(task)

    let result = await this.sendTx(txInfo)
    switch (result) {
      case SendResult.success:
        this.queue.ackMsg(task)
      case SendResult.failed:
        this.queue.nackMsg(task)
      case SendResult.insufficientFunds:
        const currentBalance = await this.web3.getBalance()
        const gasLimit = addExtraGas(txInfo.gasEstimate, EXTRA_GAS_PERCENTAGE)
        const gasPrice = this.web3.getPrice()
        let minimumBalance = gasLimit.multipliedBy(gasPrice)
        logger.error(
          `Insufficient funds: ${currentBalance}. Stop processing messages until the balance is at least ${minimumBalance}.`
        )
        this.queue.channel.close()
        this.waitForFunds(minimumBalance)
    }
  }

  async sendTx(job: TxInfo): Promise<SendResult> {
    const ttl = Number(this.ttl)

    logger.debug(`Acquiring lock: ${this.locker.key} TTL: ${ttl}ms`)
    const lock = await this.locker.lock(ttl)
    logger.debug('Lock acquired')

    let nonce: number
    try {
      nonce = await this.readNonce(false)
    } catch(e) {
      logger.error(`Failed to read nonce.`)
      return Promise.resolve(SendResult.failed)
    }

    let result = SendResult.failed
    const gasLimit = addExtraGas(job.gasEstimate, EXTRA_GAS_PERCENTAGE)
    try {
      logger.info(`Sending transaction with nonce ${nonce}`)
      const receipt = await this.web3.sendTx(nonce, gasLimit, toBN('0'), job)

      nonce++
      logger.info(receipt, `Tx generated ${receipt.transactionHash} for event Tx ${job.transactionReference}`)
      result = SendResult.success

    } catch (e) {
      logger.error(
        { eventTransactionHash: job.transactionReference, error: e.message },
        `Failed to send event Tx ${job.transactionReference}: ${e.message}`,
      )

      switch (true) {
        case SendTxError.isTxWasImportedError(e):
          logger.info(`tx ${job.transactionReference} was already imported. (skiped)`)
          result = SendResult.success
          break

        case SendTxError.isBlockGasLimitExceededError(e):
          logger.info(`tx ${job.transactionReference} block gas limit exceeded.(skiped)`)
          result = SendResult.success
          break

        case SendTxError.isInsufficientFoundError(e):
          result = SendResult.insufficientFunds
          break

        case SendTxError.isNonceTooLowError(e):
          logger.info(`tx ${job.transactionReference} nonce is too low. Force update nonce.`)
          nonce = await this.readNonce(true)
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