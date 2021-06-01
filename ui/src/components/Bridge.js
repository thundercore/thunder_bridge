import BN from "bignumber.js"
import React from "react"
import foreignLogoPurple from "../assets/images/logos/logo-poa-20-purple@2x.png"
import homeLogoPurple from "../assets/images/logos/logo-poa-sokol-purple@2x.png"
import swal from "sweetalert"
import { RenameToken } from "./utils/renameToken"
import { BRIDGE_MODES, ERC_TYPES } from "../stores/utils/bridgeMode"
import { BridgeForm } from "./index"
import { BridgeNetwork } from "./index"
import { BridgeChoose } from "./index"
import { ModalContainer } from "./ModalContainer"
import { default as NetworkDetails } from "./NetworkDetails"
import { default as TransferAlert } from "./TransferAlert"
import { inject, observer } from "mobx-react"
import { toDecimals } from "../stores/utils/decimals"
import {
  getForeignNativeToken,
  getHomeNativeToken,
} from "../stores/utils/getBridgeAddress"
import { injectIntl } from "react-intl"

@inject("RootStore")
@observer
class Bridge extends React.Component {
  state = {
    reverse: false,
    amount: "",
    recipient: "",
    modalData: {},
    confirmationData: {},
    showModal: false,
    showConfirmation: false,
    error: { enable: false, text: "" },
    transferButtonEnabled: false,
  }

  handleInputChange = (name) => (event) => {
    this.setState({
      [name]: event.target.value,
    })
    this.setState({ error: { enable: false, text: "" } })

    const { amount, recipient } = this.state
    const textFieldToCheck = name === "amount" ? recipient : amount
    this.setState({
      transferButtonEnabled:
        event.target.value !== "" && textFieldToCheck !== "",
    })
  }

  componentDidMount() {
    const { web3Store } = this.props.RootStore
    web3Store.getWeb3Promise.then(() => {
      if (!web3Store.metamaskNet.id || !web3Store.foreignNet.id) {
        this.forceUpdate()
      } else {
        const reverse =
          web3Store.metamaskNet.id.toString() ===
          web3Store.foreignNet.id.toString()
        if (reverse) {
          this.setState({
            reverse,
          })
        }
      }
    })
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    const { web3Store } = this.props.RootStore
    web3Store.getWeb3Promise.then(() => {
      const reverse =
        web3Store.metamaskNet.id.toString() ===
        web3Store.foreignNet.id.toString()
      if (reverse !== this.state.reverse) {
        this.setState({
          reverse,
        })
      }
    })
  }

  setNewToken = async (tokenName) => {
    const { homeStore, foreignStore } = this.props.RootStore
    const homePromise = homeStore.setHome(tokenName)
    const foreignPromise = foreignStore.setForeign(tokenName)
    await Promise.all([homePromise, foreignPromise])
    this.props.RootStore.alertStore.setLoading(false)
  }

  async _sendToHome(amount, recipient) {
    const {
      web3Store,
      homeStore,
      alertStore,
      txStore,
      bridgeMode,
    } = this.props.RootStore
    const { isLessThan, isGreaterThan } = this
    const { intl } = this.props

    if (
      web3Store.metamaskNet.id.toString() !== web3Store.homeNet.id.toString()
    ) {
      swal(
        intl.formatMessage({ id: "components.i18n.Bridge.error" }),
        intl.formatMessage(
          { id: "components.i18n.Bridge.switchNetwork" },
          { networkName: web3Store.homeNet.name }
        ),
        "error"
      )
      return
    }
    if (isLessThan(amount, homeStore.minPerTx)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.minAmountPerTxError",
          })} ${homeStore.minPerTx} ${homeStore.symbol}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, homeStore.maxPerTx)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.maxAmountPerTxError",
          })} ${homeStore.maxPerTx} ${homeStore.symbol}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, homeStore.maxCurrentDeposit)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.depositDailyLimitError",
          })} ${homeStore.maxCurrentDeposit} ${homeStore.symbol}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, homeStore.getDisplayedBalance())) {
      this.setState({
        error: {
          enable: true,
          text: intl.formatMessage({
            id: "components.i18n.Bridge.insufficientBalance",
          }),
        },
      })
    } else {
      try {
        alertStore.setLoading(true)
        if (homeStore.symbol === getHomeNativeToken()) {
          return await txStore.ethTransferAndCall({
            to: homeStore.HOME_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toDecimals(amount, homeStore.tokenDecimals),
            contract: homeStore.tokenContract,
            tokenAddress: homeStore.tokenAddress,
            recipient,
          })
        }

        return txStore.erc677transferAndCall({
          to: homeStore.HOME_BRIDGE_ADDRESS,
          from: web3Store.defaultAccount.address,
          value: toDecimals(amount, homeStore.tokenDecimals),
          contract: homeStore.tokenContract,
          tokenAddress: homeStore.tokenAddress,
          recipient,
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  async _sendToForeign(amount, recipient) {
    const {
      web3Store,
      foreignStore,
      alertStore,
      txStore,
    } = this.props.RootStore
    const isExternalErc20 = foreignStore.tokenType === ERC_TYPES.ERC20
    const { isLessThan, isGreaterThan } = this
    const { intl } = this.props

    if (
      web3Store.metamaskNet.id.toString() !== web3Store.foreignNet.id.toString()
    ) {
      swal(
        intl.formatMessage({ id: "components.i18n.Bridge.error" }),
        intl.formatMessage(
          { id: "components.i18n.Bridge.switchNetwork" },
          { networkName: web3Store.foreignNet.name }
        ),
        "error"
      )
      return
    }
    if (isLessThan(amount, foreignStore.minPerTx)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.minAmountPerTxError",
          })} ${foreignStore.minPerTx} ${RenameToken(foreignStore.symbol)}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, foreignStore.maxPerTx)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.maxAmountPerTxError",
          })} ${foreignStore.maxPerTx} ${RenameToken(foreignStore.symbol)}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, foreignStore.maxCurrentDeposit)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.withdrawalDailyLimitError",
          })} ${foreignStore.maxCurrentDeposit} ${RenameToken(
            foreignStore.symbol
          )}`,
        },
      })
      return
    }
    if (isGreaterThan(amount, foreignStore.balance)) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.insufficientBalance2",
          })} ${foreignStore.balance} ${RenameToken(foreignStore.symbol)}`,
        },
      })
    } else {
      try {
        alertStore.setLoading(true)
        if (foreignStore.symbol === getForeignNativeToken()) {
          return await txStore.ethTransfer({
            to: foreignStore.FOREIGN_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toDecimals(amount, foreignStore.tokenDecimals),
            tokenAddress: foreignStore.tokenAddress,
            recipient,
          })
        }
        return await txStore.erc20transfer({
          to: foreignStore.FOREIGN_BRIDGE_ADDRESS,
          from: web3Store.defaultAccount.address,
          value: toDecimals(amount, foreignStore.tokenDecimals),
          tokenAddress: foreignStore.tokenAddress,
          recipient,
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  isLessThan = (amount, base) => new BN(amount).lt(new BN(base))

  isGreaterThan = (amount, base) => new BN(amount).gt(new BN(base))

  onTransfer = async (e) => {
    e.preventDefault()

    const { amount } = this.state
    const inputAmount = amount.trim()
    const { intl } = this.props

    if (!inputAmount) {
      this.setState({
        error: {
          enable: true,
          text: intl.formatMessage({
            id: "components.i18n.Bridge.specifyAmount",
          }),
        },
      })
      return
    }

    const {
      foreignStore,
      web3Store,
      homeStore,
      alertStore,
    } = this.props.RootStore

    if (
      (web3Store.metamaskNotSetted && web3Store.metamaskNet.name === "") ||
      web3Store.defaultAccount.address === undefined
    ) {
      web3Store.showInstallMetamaskAlert()
      return
    }

    const { reverse, recipient } = this.state
    const homeDisplayName = homeStore.networkName
    const foreignDisplayName = foreignStore.networkName

    let fee = null
    let finalAmount = new BN(amount)
    if (reverse) {
      // foreign to home
      fee = await homeStore.getDepositFee(amount)
      if (!fee.isZero()) {
        finalAmount = finalAmount.minus(fee)
      }
    } else {
      // home to foreign
      fee = await homeStore.getWithdrawFee(amount)
      if (!fee.isZero()) {
        finalAmount = finalAmount.minus(fee)
      }
    }

    if (finalAmount.lte(new BN(0))) {
      this.setState({
        error: {
          enable: true,
          text: `${intl.formatMessage({
            id: "components.i18n.Bridge.minFeeError",
          })} ${fee} ${homeStore.symbol}`,
        },
      })
      return
    }

    const confirmationData = {
      from: reverse ? foreignDisplayName : homeDisplayName,
      to: reverse ? homeDisplayName : foreignDisplayName,
      fromCurrency: reverse ? foreignStore.symbol : homeStore.symbol,
      toCurrency: reverse ? homeStore.symbol : foreignStore.symbol,
      fromAmount: amount,
      toAmount: finalAmount,
      minPerTx: homeStore.minPerTx,
      fee,
      feeCurrency: homeStore.symbol,
      reverse,
      recipient,
    }

    this.setState({ showConfirmation: true, confirmationData })
  }

  onTransferConfirmation = async () => {
    const { alertStore } = this.props.RootStore
    const { reverse, recipient, amount } = this.state

    this.setState({ showConfirmation: false, confirmationData: {} })
    const inputAmount = amount.trim()
    const { intl } = this.props
    if (!inputAmount) {
      this.setState({
        error: {
          enable: true,
          text: intl.formatMessage({
            id: "components.i18n.Bridge.specifyAmount",
          }),
        },
      })
      return
    }

    try {
      if (reverse) {
        await this._sendToForeign(amount, recipient)
      } else {
        await this._sendToHome(amount, recipient)
      }
    } catch (e) {
      if (
        !e.message.includes("not mined within 50 blocks") &&
        !e.message.includes("Failed to subscribe to new newBlockHeaders")
      ) {
        alertStore.setLoading(false)
      }
    }
  }

  loadHomeDetails = () => {
    const { web3Store, homeStore, bridgeMode } = this.props.RootStore
    const isErcToErcMode = bridgeMode === BRIDGE_MODES.ERC_TO_ERC
    const isExternalErc20 =
      bridgeMode === BRIDGE_MODES.ERC_TO_ERC ||
      bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE
    const fixedFee = homeStore.feeManager.withdrawFixedFee
    const feePercent = homeStore.feeManager.withdrawFeePercent
    const feeCurrency = homeStore.symbol

    const modalData = {
      isHome: true,
      networkData: web3Store.homeNet,
      url: web3Store.HOME_HTTP_PARITY_URL,
      logo: homeLogoPurple,
      address: homeStore.HOME_BRIDGE_ADDRESS,
      currency: homeStore.symbol,
      maxCurrentLimit: homeStore.maxCurrentDeposit,
      maxPerTx: homeStore.maxPerTx,
      minPerTx: homeStore.minPerTx,
      totalBalance: homeStore.balance,
      balance: homeStore.getDisplayedBalance(),
      displayTokenAddress: isErcToErcMode,
      tokenAddress: homeStore.tokenAddress,
      tokenName: homeStore.tokenName,
      displayBridgeLimits: true,
      nativeSupplyTitle: !isExternalErc20,
      getExplorerAddressUrl: (address) =>
        homeStore.getExplorerAddressUrl(address),
      fixedFee,
      feePercent,
      feeCurrency,
    }

    this.setState({ modalData, showModal: true })
  }

  loadForeignDetails = () => {
    const { web3Store, foreignStore, homeStore } = this.props.RootStore
    const isExternalErc20 = foreignStore.tokenType === ERC_TYPES.ERC20
    const foreignURL = new URL(web3Store.FOREIGN_HTTP_PARITY_URL)
    const foreignDisplayUrl = `${foreignURL.protocol}//${foreignURL.hostname}`
    const fixedFee = homeStore.feeManager.depositFixedFee
    const feePercent = homeStore.feeManager.depositFeePercent
    const feeCurrency = homeStore.symbol

    const modalData = {
      isHome: false,
      networkData: web3Store.foreignNet,
      url: foreignDisplayUrl,
      logo: foreignLogoPurple,
      address: foreignStore.FOREIGN_BRIDGE_ADDRESS,
      currency: foreignStore.symbol,
      maxCurrentLimit: foreignStore.maxCurrentDeposit,
      maxPerTx: foreignStore.maxPerTx,
      minPerTx: foreignStore.minPerTx,
      tokenAddress: foreignStore.tokenAddress,
      tokenName: foreignStore.tokenName,
      totalSupply: foreignStore.totalSupply,
      balance: foreignStore.balance,
      displayTokenAddress: true,
      displayBridgeLimits: true,
      getExplorerAddressUrl: (address) =>
        foreignStore.getExplorerAddressUrl(address),
      fixedFee,
      feePercent,
      feeCurrency,
    }

    this.setState({ modalData, showModal: true })
  }

  getNetworkTitle = (networkName) => {
    const index = networkName.indexOf(" ")

    if (index === -1) {
      return networkName
    }

    return networkName.substring(0, index)
  }

  getNetworkSubTitle = (networkName) => {
    const index = networkName.indexOf(" ")

    if (index === -1) {
      return false
    }

    return networkName.substring(index + 1, networkName.length)
  }

  resetForm = () => {
    this.setState({
      error: { enable: false, text: "" },
    })
  }

  render() {
    const { intl } = this.props
    const {
      web3Store,
      foreignStore,
      homeStore,
      alertStore,
    } = this.props.RootStore
    const {
      reverse,
      showModal,
      modalData,
      showConfirmation,
      confirmationData,
      transferButtonEnabled,
    } = this.state
    const formCurrency = reverse ? foreignStore.symbol : homeStore.symbol
    const store = reverse ? foreignStore : homeStore

    if (showModal && Object.keys(modalData).length !== 0) {
      if (
        modalData.isHome &&
        modalData.balance !== homeStore.getDisplayedBalance()
      ) {
        modalData.balance = homeStore.getDisplayedBalance()
      } else if (
        !modalData.isHome &&
        modalData.balance !== foreignStore.balance
      ) {
        modalData.balance = foreignStore.balance
      }
    }

    const homeNetworkName = this.getNetworkTitle(homeStore.networkName)
    const homeNetworkSubtitle = this.getNetworkSubTitle(homeStore.networkName)
    const foreignNetworkName = this.getNetworkTitle(foreignStore.networkName)
    const foreignNetworkSubtitle = this.getNetworkSubTitle(
      foreignStore.networkName
    )
    const network = reverse ? homeNetworkName : foreignNetworkName
    const textFieldPlaceHolder = intl.formatMessage(
      { id: "components.i18n.Bridge.networkAddress" },
      { networkName: network }
    )

    return (
      <div className="bridge-container">
        <div className="bridge">
          <div className="bridge-transfer">
            <div className="bridge-transfer-content">
              <div className="bridge-title"></div>
              <div className="bridge-transfer-content-background">
                <BridgeNetwork
                  balance={
                    reverse
                      ? foreignStore.balance
                      : homeStore.getDisplayedBalance()
                  }
                  currency={reverse ? foreignStore.symbol : homeStore.symbol}
                  isHome={!reverse}
                  networkSubtitle={
                    reverse ? foreignNetworkSubtitle : homeNetworkSubtitle
                  }
                  networkTitle={reverse ? foreignNetworkName : homeNetworkName}
                  showModal={
                    reverse ? this.loadForeignDetails : this.loadHomeDetails
                  }
                  side="left"
                />
                <BridgeForm
                  currency={formCurrency}
                  displayArrow={!web3Store.metamaskNotSetted}
                  onAmountInputChange={this.handleInputChange("amount")}
                  onRecipientInputChange={this.handleInputChange("recipient")}
                  onTransfer={this.onTransfer}
                  reverse={reverse}
                  placeHolder={textFieldPlaceHolder}
                  error={this.state.error}
                  maxCurrentDeposit={store.maxCurrentDeposit}
                  maxPerTx={store.maxPerTx}
                  minPerTx={store.minPerTx}
                  buttonEnabled={transferButtonEnabled}
                />
                <BridgeNetwork
                  balance={
                    reverse
                      ? homeStore.getDisplayedBalance()
                      : foreignStore.balance
                  }
                  currency={reverse ? homeStore.symbol : foreignStore.symbol}
                  isHome={reverse}
                  networkSubtitle={
                    reverse ? homeNetworkSubtitle : foreignNetworkSubtitle
                  }
                  networkTitle={reverse ? homeNetworkName : foreignNetworkName}
                  showModal={
                    reverse ? this.loadHomeDetails : this.loadForeignDetails
                  }
                  side="right"
                />
              </div>
              <BridgeChoose
                setNewTokenHandler={this.setNewToken}
                web3Store={web3Store}
                alert={alertStore}
                isHome={!reverse}
                foreignStore={foreignStore}
                homeStore={homeStore}
                resetForm={this.resetForm}
              />
            </div>
          </div>
          <ModalContainer
            hideModal={() => {
              this.setState({ showModal: false })
            }}
            showModal={showModal}
          >
            <NetworkDetails {...modalData} />
          </ModalContainer>
          <ModalContainer showModal={showConfirmation}>
            <TransferAlert
              onConfirmation={this.onTransferConfirmation}
              onCancel={() => {
                this.setState({ showConfirmation: false, confirmationData: {} })
              }}
              {...confirmationData}
            />
          </ModalContainer>
        </div>
      </div>
    )
  }
}

export default injectIntl(Bridge)
