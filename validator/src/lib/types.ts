import { EventData } from 'web3-eth-contract'
import BN from 'bn.js'

export interface EventTask {
  eventType: string
  event: EventData

  nonce?: number
  retries?: number
  timestamp?: number
}

export function isRetryTask(task: EventTask): boolean {
  return !!task.retries && task.retries > 0
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

export type enqueue<T> = (task: T) => Promise<void>;
export type enqueueSender = enqueue<EventTask>
export type enqueueReceiptor = enqueue<ReceiptTask>