import React, { Component } from "react"
import noWalletIcon from "../assets/images/no-wallet-modal/i@3x.png"
import { ModalContainer } from "./ModalContainer"
import { inject, observer } from "mobx-react"
import { FormattedMessage } from "react-intl"

@inject("RootStore")
@observer
export class NoWallet extends Component {
  state = {
    showModal: true,
  }

  handleCancel = () => {
    this.setState({ showModal: false })
  }

  render() {
    const {
      RootStore: {
        web3Store: { walletInstalled },
      },
      showModal: showNoWallet,
    } = this.props
    const showModal = showNoWallet && !walletInstalled

    if (!showModal || !this.state.showModal) return null

    return (
      <ModalContainer showModal={showModal && this.state.showModal}>
        <div className="noWallet-alert">
          <div className="noWallet-alert-container">
            <h2 className="noWallet-title">
              <FormattedMessage id="components.i18n.NoWallet.wrongNetwork" />
            </h2>
            <p className="noWallet-description">
              <FormattedMessage id="components.i18n.NoWallet.switchNetwork" />
            </p>
            <div className="noWallet-buttons">
              <a
                className="noWallet-metamask"
                href="https://support-center.thundercore.com/docs/metamask/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <FormattedMessage id="components.i18n.NoWallet.learnSetUp" />
              </a>
              <button className="noWallet-cancel" onClick={this.handleCancel}>
                <FormattedMessage id="components.i18n.NoWallet.gotIt" />
              </button>
            </div>
          </div>
        </div>
      </ModalContainer>
    )
  }
}
