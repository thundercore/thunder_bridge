import { action, observable } from "mobx"
import { estimateGas } from "./utils/web3"
import {
  addPendingTransaction,
  removePendingTransaction,
} from "./utils/testUtils"
import { getUnit } from "./utils/bridgeMode"
import yn from "../components/utils/yn"
import { getI18nKey } from "../utils/locale"
import { i18nStores } from "./i18n/i18nStores"

class TxStore {
  @observable
  txsValues = {}

  locale = getI18nKey(window.hubLang)

  constructor(rootStore) {
    this.web3Store = rootStore.web3Store
    this.gasPriceStore = rootStore.gasPriceStore
    this.alertStore = rootStore.alertStore
    this.foreignStore = rootStore.foreignStore
    this.homeStore = rootStore.homeStore
    this.rootStore = rootStore
  }

  @action
  async doSend({ to, from, value, data, sentValue, recipient }) {
    return this.web3Store.getWeb3Promise.then(async () => {
      if (!this.web3Store.defaultAccount) {
        this.alertStore.pushError(i18nStores["unlockWallet"][this.locale])
        return
      }
      try {
        const gasPrice = this.gasPriceStore.gasPriceInHex
        const gas = await estimateGas(
          this.web3Store.injectedWeb3,
          to,
          gasPrice,
          from,
          value,
          data
        )
        return this.web3Store.injectedWeb3.eth
          .sendTransaction({
            to,
            gasPrice,
            gas,
            from,
            value,
            data,
            chainId: this.web3Store.metamaskNet.id,
          })
          .on("transactionHash", (hash) => {
            console.log("txHash", hash)
            this.txsValues[hash] = sentValue
            this.alertStore.setLoadingStepIndex(1)
            addPendingTransaction()
            this.getTxReceipt(hash, recipient)
          })
          .on("error", (e) => {
            if (
              !e.message.includes("not mined within 50 blocks") &&
              !e.message.includes("Failed to subscribe to new newBlockHeaders")
            ) {
              this.alertStore.setLoading(false)
              this.alertStore.pushError(
                i18nStores["transactionRejected"][this.locale]
              )
            }
          })
      } catch (e) {
        this.alertStore.pushError(e.message)
      }
    })
  }

  @action
  async erc677transferAndCall({
    to,
    from,
    value,
    contract,
    tokenAddress,
    recipient,
  }) {
    try {
      return this.web3Store.getWeb3Promise.then(async () => {
        if (this.web3Store.defaultAccount.address) {
          const recipientData = `0x000000000000000000000000${recipient.slice(
            2
          )}`
          const data = await contract.methods
            .transferAndCall(to, value, recipientData)
            .encodeABI()
          return this.doSend({
            to: tokenAddress,
            from,
            value: "0x00",
            data,
            sentValue: value,
            recipient,
          })
        } else {
          this.alertStore.pushError(i18nStores["unlockWallet"][this.locale])
        }
      })
    } catch (e) {
      this.alertStore.pushError(e)
    }
  }

  @action
  async ethTransferAndCall({
    to,
    from,
    value,
    contract,
    tokenAddress,
    recipient,
  }) {
    try {
      return this.web3Store.getWeb3Promise.then(async () => {
        if (this.web3Store.defaultAccount.address) {
          const recipientData = `0x000000000000000000000000${recipient.slice(
            2
          )}`
          const data = await contract.methods
            .transferAndCall(to, value, recipientData)
            .encodeABI({ from: this.web3Store.defaultAccount.address })
          return this.doSend({
            to: tokenAddress,
            from,
            value,
            data,
            sentValue: value,
            recipient,
          })
        } else {
          this.alertStore.pushError(i18nStores["unlockWallet"][this.locale])
        }
      })
    } catch (e) {
      this.alertStore.pushError(e)
    }
  }

  @action
  async ethTransfer({ to, from, value, recipient, tokenAddress }) {
    try {
      return this.web3Store.getWeb3Promise.then(async () => {
        if (this.web3Store.defaultAccount.address) {
          let data = await this.foreignStore.tokenContract.methods
            .transfer(to, value)
            .encodeABI({ from: this.web3Store.defaultAccount.address })
          data += `000000000000000000000000${recipient.slice(2)}`

          return this.doSend({
            to: tokenAddress,
            from,
            value,
            data,
            sentValue: value,
            recipient,
          })
        } else {
          this.alertStore.pushError(i18nStores["unlockWallet"][this.locale])
        }
      })
    } catch (e) {
      this.alertStore.pushError(e)
    }
  }

  @action
  async erc20transfer({ to, from, value, recipient }) {
    try {
      return this.web3Store.getWeb3Promise.then(async () => {
        if (this.web3Store.defaultAccount.address) {
          let data = await this.foreignStore.tokenContract.methods
            .transfer(to, value)
            .encodeABI({ from: this.web3Store.defaultAccount.address })
          data += `000000000000000000000000${recipient.slice(2)}`

          return this.doSend({
            to: this.foreignStore.tokenAddress,
            from,
            value: "0x",
            data,
            sentValue: value,
            recipient,
          })
        } else {
          this.alertStore.pushError(i18nStores["unlockWallet"][this.locale])
        }
      })
    } catch (e) {
      this.alertStore.pushError(e)
    }
  }

  async getTxReceipt(hash, recipient) {
    const web3 = this.web3Store.injectedWeb3
    web3.eth.getTransaction(hash, (error, res) => {
      if (res && res.blockNumber) {
        this.getTxStatus(hash, recipient)
      } else {
        console.log("not mined yet", hash)
        setTimeout(() => {
          this.getTxReceipt(hash, recipient)
        }, 5000)
      }
    })
  }

  async getTxStatus(hash, recipient) {
    const web3 = this.web3Store.injectedWeb3
    web3.eth.getTransactionReceipt(hash, (error, res) => {
      if (res && res.blockNumber) {
        if (this.isStatusSuccess(res)) {
          if (this.web3Store.metamaskNet.id === this.web3Store.homeNet.id) {
            const blockConfirmations =
              this.homeStore.latestBlockNumber - res.blockNumber
            if (blockConfirmations >= 8) {
              this.alertStore.setBlockConfirmations(8)
              this.alertStore.setLoadingStepIndex(2)

              if (yn(process.env.REACT_APP_FOREIGN_WITHOUT_EVENTS)) {
                this.foreignStore.waitUntilProcessed(hash).then(() => {
                  this.alertStore.setLoadingStepIndex(3)
                  const unitReceived = getUnit(this.rootStore.bridgeMode)
                    .unitForeign
                  setTimeout(() => {
                    this.alertStore.pushSuccess(
                      `${unitReceived} received on ${this.foreignStore.networkName}`,
                      this.alertStore.FOREIGN_TRANSFER_SUCCESS
                    )
                  }, 2000)
                  removePendingTransaction()
                })
              } else {
                this.foreignStore.addWaitingForConfirmation(hash)
              }
            } else {
              if (blockConfirmations > 0) {
                this.alertStore.setBlockConfirmations(blockConfirmations)
              }
              this.getTxStatus(hash, recipient)
            }
          } else {
            const blockConfirmations =
              this.foreignStore.latestBlockNumber - res.blockNumber
            if (blockConfirmations >= 8) {
              this.alertStore.setBlockConfirmations(8)
              this.alertStore.setLoadingStepIndex(2)

              if (yn(process.env.REACT_APP_HOME_WITHOUT_EVENTS)) {
                this.homeStore
                  .waitUntilProcessed(hash, this.txsValues[hash], recipient)
                  .then(() => {
                    this.alertStore.setLoadingStepIndex(3)
                    const unitReceived = getUnit(this.rootStore.bridgeMode)
                      .unitHome
                    setTimeout(() => {
                      this.alertStore.pushSuccess(
                        `${unitReceived} received on ${this.homeStore.networkName}`,
                        this.alertStore.HOME_TRANSFER_SUCCESS
                      )
                    }, 2000)
                    removePendingTransaction()
                  })
              } else {
                this.homeStore.addWaitingForConfirmation(hash)
              }
            } else {
              if (blockConfirmations > 0) {
                this.alertStore.setBlockConfirmations(blockConfirmations)
              }
              this.getTxStatus(hash, recipient)
            }
          }
        } else {
          this.alertStore.setLoading(false)
          this.alertStore.pushError(
            `${hash} Mined but with errors. Perhaps out of gas`
          )
        }
      } else {
        this.getTxStatus(hash, recipient)
      }
    })
  }

  isStatusSuccess(tx) {
    const { toBN } = this.web3Store.injectedWeb3.utils
    const statusSuccess =
      tx.status && (tx.status === true || toBN(tx.status).eq(toBN(1)))
    const eventEmitted = tx.logs && tx.logs.length
    return statusSuccess || eventEmitted
  }
}

export default TxStore
