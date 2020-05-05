import { EventData } from 'web3-eth-contract';
import BN from 'bn.js'

export interface EventTask {
  eventType: string,
  event: EventData
}


export interface TxInfo {
  data: string
  gasEstimate: BN
  transactionReference: string
  to: string
}