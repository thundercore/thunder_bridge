import { EventData } from 'web3-eth-contract'
import BN from 'bn.js'

export interface EventTask {
  eventType: string
  event: EventData

  nonce?: number
  retries?: number
  timestamp?: number
}

export interface ReceiptTask {
  eventTask: EventTask
  nonce: number
  timestamp: number
  transactionHash: string
  sentBlock: number

  retries?: number
}

export interface TxInfo {
  data: string
  gasEstimate: BN
  transactionReference: string
  to: string
  eventTask: EventTask
}