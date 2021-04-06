import { defineMessages } from "react-intl"

export default defineMessages({
  switchNetwork: "Please switch wallet to {networkName} network",
  minAmountPerTxError:
    "The amount is less than the current minimum amount per transaction.\nThe minimum amount per transaction is:",
  maxAmountPerTxError:
    "The amount is above the current maximum amount per transaction.\nThe maximum amount per transaction is:",
  depositDailyLimitError:
    "The amount is above the current daily limit.\nThe maximum deposit today:",
  insufficientBalance: "Insufficient balance",
  withdrawalDailyLimitError:
    "The amount is above current daily limit.\nThe max withdrawal today:",
  insufficientBalance2: "Insufficient token balance. Your balance is",
  specifyAmount: "Please specify amount",
  minFeeError:
    "The amount that you entered does not cover the transaction fee.\nThe minimum transaction amount is:",
})
