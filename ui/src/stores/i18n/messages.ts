import { defineMessages } from "react-intl"

export default defineMessages({
  error: "Error",
  loading: "Loading",
  waitConfirmations: "Waiting for Block Confirmations...",
  verifyingTransaction: "Validators Verifying Transaction...",
  transferComplete: "Transfer Complete",
  errWrongNetwork: "Wrong network error",
  errHomeConnection: "Home Connection Error",
  errForeignConnection: "Foreign Connection Error",
  successHomeTransfer: "Home Transfer Success",
  successForeignTransfer: "Foreign Transfer Success",
  unlockWallet: "Please unlock wallet",
  unknownNetwork:
    "You are on an unknown network on your wallet. Please select {homeNet} or {foreignNet} in order to communicate with the bridge.",
})
