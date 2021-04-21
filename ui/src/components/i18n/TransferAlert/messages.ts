import { defineMessages } from "react-intl"

export default defineMessages({
  recipient: "Recipient: {recipient}",
  txFee: "Transaction fee: {fee} {currency}",
  confirmText:
    "Please confirm that you would like to send {fromAmount} {fromCurrency} from {fromNetwork} to receive {toAmount} {toCurrency} on {toNetwork}.",
  continue: "Continue",
  cancel: "Cancel",
})
