import BN from 'bignumber.js'
import React from 'react'
import { toHex } from 'web3-utils'
import foreignLogoPurple from '../assets/images/logos/logo-poa-20-purple@2x.png'
import homeLogoPurple from '../assets/images/logos/logo-poa-sokol-purple@2x.png'
import swal from 'sweetalert'
import { BRIDGE_MODES, ERC_TYPES } from '../stores/utils/bridgeMode'
import { BridgeAddress } from './index'
import { BridgeForm } from './index'
import { BridgeNetwork } from './index'
import { BridgeChoose } from './index'
import { ModalContainer } from './ModalContainer'
import { NetworkDetails } from './NetworkDetails'
import { TransferAlert } from './TransferAlert'
import { inject, observer } from 'mobx-react'
import { toDecimals } from '../stores/utils/decimals'

@inject('RootStore')
@observer
export class Bridge extends React.Component {
  state = {
    reverse: false,
    amount: '',
    recipient: '',
    modalData: {},
    confirmationData: {},
    showModal: false,
    showConfirmation: false
  }

  handleInputChange = name => event => {
    this.setState({
      [name]: event.target.value
    })
  }

  componentDidMount() {
    const { web3Store } = this.props.RootStore
    web3Store.getWeb3Promise.then(() => {
      if (!web3Store.metamaskNet.id || !web3Store.foreignNet.id) {
        this.forceUpdate()
      } else {
        const reverse = web3Store.metamaskNet.id.toString() === web3Store.foreignNet.id.toString()
        if (reverse) {
          this.setState({
            reverse
          })
        }
      }
    })
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    const { web3Store } = this.props.RootStore
    web3Store.getWeb3Promise.then(() => {
      const reverse = web3Store.metamaskNet.id.toString() === web3Store.foreignNet.id.toString()
      if (reverse !== this.state.reverse) {
        this.setState({
          reverse
        })
      }
      if (!this.state.recipient && web3Store.defaultAccount.address && !prevState.recipient) {
        this.setState({
          recipient: web3Store.defaultAccount.address
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
    const { web3Store, homeStore, alertStore, txStore, bridgeMode } = this.props.RootStore
    const isErcToErcMode = bridgeMode === BRIDGE_MODES.ERC_TO_ERC
    const { isLessThan, isGreaterThan } = this
    if (web3Store.metamaskNet.id.toString() !== web3Store.homeNet.id.toString()) {
      swal('Error', `Please switch wallet to ${web3Store.homeNet.name} network`, 'error')
      return
    }
    if (isLessThan(amount, homeStore.minPerTx)) {
      alertStore.pushError(
        `The amount is less than current minimum per transaction amount.\nThe minimum per transaction amount is: ${
          homeStore.minPerTx
        } ${homeStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, homeStore.maxPerTx)) {
      alertStore.pushError(
        `The amount is above current maximum per transaction limit.\nThe maximum per transaction limit is: ${
          homeStore.maxPerTx
        } ${homeStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, homeStore.maxCurrentDeposit)) {
      alertStore.pushError(
        `The amount is above current daily limit.\nThe max deposit today: ${
          homeStore.maxCurrentDeposit
        } ${homeStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, homeStore.getDisplayedBalance())) {
      alertStore.pushError('Insufficient balance')
    } else {
      try {
        alertStore.setLoading(true)
        if (isErcToErcMode) {
          return txStore.erc677transferAndCall({
            to: homeStore.HOME_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toDecimals(amount, homeStore.tokenDecimals),
            contract: homeStore.tokenContract,
            tokenAddress: homeStore.tokenAddress,
            recipient
          })
        } else {
          const value = toHex(toDecimals(amount, homeStore.tokenDecimals))
          return txStore.doSend({
            to: homeStore.HOME_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value,
            data: '0x',
            sentValue: value,
            recipient
          })
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  async _sendToForeign(amount, recipient) {
    const { web3Store, foreignStore, alertStore, txStore } = this.props.RootStore
    const isExternalErc20 = foreignStore.tokenType === ERC_TYPES.ERC20
    const { isLessThan, isGreaterThan } = this
    if (web3Store.metamaskNet.id.toString() !== web3Store.foreignNet.id.toString()) {
      swal('Error', `Please switch wallet to ${web3Store.foreignNet.name} network`, 'error')
      return
    }
    if (isLessThan(amount, foreignStore.minPerTx)) {
      alertStore.pushError(
        `The amount is less than minimum amount per transaction.\nThe min per transaction is: ${
          foreignStore.minPerTx
        } ${foreignStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, foreignStore.maxPerTx)) {
      alertStore.pushError(
        `The amount is above maximum amount per transaction.\nThe max per transaction is: ${
          foreignStore.maxPerTx
        } ${foreignStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, foreignStore.maxCurrentDeposit)) {
      alertStore.pushError(
        `The amount is above current daily limit.\nThe max withdrawal today: ${
          foreignStore.maxCurrentDeposit
        } ${foreignStore.symbol}`
      )
      return
    }
    if (isGreaterThan(amount, foreignStore.balance)) {
      alertStore.pushError(
        `Insufficient token balance. Your balance is ${foreignStore.balance} ${foreignStore.symbol}`
      )
    } else {
      try {
        alertStore.setLoading(true)
        if (foreignStore.symbol.includes('ETH')) {
          return await txStore.ethTransfer({
            to: foreignStore.FOREIGN_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toDecimals(amount, foreignStore.tokenDecimals),
            recipient
          })
        }
        if (isExternalErc20) {
          return await txStore.erc20transfer({
            to: foreignStore.FOREIGN_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toDecimals(amount, foreignStore.tokenDecimals),
            recipient
          })
        } else {
          return await txStore.erc677transferAndCall({
            to: foreignStore.FOREIGN_BRIDGE_ADDRESS,
            from: web3Store.defaultAccount.address,
            value: toHex(toDecimals(amount, foreignStore.tokenDecimals)),
            contract: foreignStore.tokenContract,
            tokenAddress: foreignStore.tokenAddress,
            recipient
          })
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  isLessThan = (amount, base) => new BN(amount).lt(new BN(base))

  isGreaterThan = (amount, base) => new BN(amount).gt(new BN(base))

  onTransfer = async e => {
    e.preventDefault()

    const amount = this.state.amount.trim()
    if (!amount) {
      swal('Error', 'Please specify amount', 'error')
      return
    }

    const { foreignStore, web3Store, homeStore, alertStore } = this.props.RootStore

    if (
      (web3Store.metamaskNotSetted && web3Store.metamaskNet.name === '') ||
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
    if (reverse) { // foreign to home
      fee = await homeStore.getDepositFee(amount)
      if (!fee.isZero()) {
        finalAmount = finalAmount.minus(fee)
      }
    } else { // home to foreign
      fee = await homeStore.getWithdrawFee(amount)
      if (!fee.isZero()) {
        finalAmount = finalAmount.minus(fee)
      }
    }

    if (finalAmount.lte(new BN(0))) {
      alertStore.pushError(
        `The amount is less than minimum fee amount.\nThe minimum transaction fee is: ${
          fee
        } ${homeStore.symbol}`
      )
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
      recipient
    }

    this.setState({ showConfirmation: true, confirmationData })
  }

  onTransferConfirmation = async () => {
    const { alertStore } = this.props.RootStore
    const { reverse, recipient } = this.state

    this.setState({ showConfirmation: false, confirmationData: {} })
    const amount = this.state.amount.trim()
    if (!amount) {
      swal('Error', 'Please specify amount', 'error')
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
        !e.message.includes('not mined within 50 blocks') &&
        !e.message.includes('Failed to subscribe to new newBlockHeaders')
      ) {
        alertStore.setLoading(false)
      }
    }
  }

  loadHomeDetails = () => {
    const { web3Store, homeStore, bridgeMode } = this.props.RootStore
    const isErcToErcMode = bridgeMode === BRIDGE_MODES.ERC_TO_ERC
    const isExternalErc20 =
      bridgeMode === BRIDGE_MODES.ERC_TO_ERC || bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE
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
      getExplorerAddressUrl: address => homeStore.getExplorerAddressUrl(address),
      fixedFee,
      feePercent,
      feeCurrency
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
      getExplorerAddressUrl: address => foreignStore.getExplorerAddressUrl(address),
      fixedFee,
      feePercent,
      feeCurrency
    }

    this.setState({ modalData, showModal: true })
  }

  getNetworkTitle = networkName => {
    const index = networkName.indexOf(' ')

    if (index === -1) {
      return networkName
    }

    return networkName.substring(0, index)
  }

  getNetworkSubTitle = networkName => {
    const index = networkName.indexOf(' ')

    if (index === -1) {
      return false
    }

    return networkName.substring(index + 1, networkName.length)
  }

  render() {
    const { web3Store, foreignStore, homeStore, alertStore } = this.props.RootStore
    const { reverse, showModal, modalData, showConfirmation, confirmationData/*, recipient*/ } = this.state
    const formCurrency = reverse ? foreignStore.symbol : homeStore.symbol

    if (showModal && Object.keys(modalData).length !== 0) {
      if (modalData.isHome && modalData.balance !== homeStore.getDisplayedBalance()) {
        modalData.balance = homeStore.getDisplayedBalance()
      } else if (!modalData.isHome && modalData.balance !== foreignStore.balance) {
        modalData.balance = foreignStore.balance
      }
    }

    const homeNetworkName = this.getNetworkTitle(homeStore.networkName)
    const homeNetworkSubtitle = this.getNetworkSubTitle(homeStore.networkName)
    const foreignNetworkName = this.getNetworkTitle(foreignStore.networkName)
    const foreignNetworkSubtitle = this.getNetworkSubTitle(foreignStore.networkName)

    return (
      <div className="bridge-container">
        <div className="bridge">
          <div className="bridge-transfer">
            <div className="bridge-transfer-content">
              <div className="bridge-title">Bridge</div>
              <div className="bridge-transfer-content-background">
                <BridgeNetwork
                  balance={reverse ? foreignStore.balance : homeStore.getDisplayedBalance()}
                  currency={reverse ? foreignStore.symbol : homeStore.symbol}
                  isHome={!reverse}
                  networkSubtitle={reverse ? foreignNetworkSubtitle : homeNetworkSubtitle}
                  networkTitle={reverse ? foreignNetworkName : homeNetworkName}
                  showModal={reverse ? this.loadForeignDetails : this.loadHomeDetails}
                  side="left"
                />
                <BridgeForm
                  currency={formCurrency}
                  displayArrow={!web3Store.metamaskNotSetted}
                  onAmountInputChange={this.handleInputChange('amount')}
                  onRecipientInputChange={this.handleInputChange('recipient')}
                  onTransfer={this.onTransfer}
                  reverse={reverse}
                />
                <BridgeNetwork
                  balance={reverse ? homeStore.getDisplayedBalance() : foreignStore.balance}
                  currency={reverse ? homeStore.symbol : foreignStore.symbol}
                  isHome={reverse}
                  networkSubtitle={reverse ? homeNetworkSubtitle : foreignNetworkSubtitle}
                  networkTitle={reverse ? homeNetworkName : foreignNetworkName}
                  showModal={reverse ? this.loadHomeDetails : this.loadForeignDetails}
                  side="right"
                />
              </div>
              <BridgeChoose
                setNewTokenHandler={this.setNewToken}
                web3Store = {web3Store}
                alert = {alertStore}
                isHome = {!reverse}
                foreignStore = {foreignStore}
                homeStore = {homeStore}
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
