import React from "react"
import yn from "./utils/yn"
import { BRIDGE_MODES } from "../stores/utils/bridgeMode"
import { BridgeStatistics } from "./index"
import { Redirect } from "react-router"
import { default as TransactionsStatistics } from "./TransactionsStatistics"
import { inject, observer } from "mobx-react"
import { FeeStatistics } from "./FeeStatistics"
import { FormattedMessage } from "react-intl"

@inject("RootStore")
@observer
export class StatisticsPage extends React.Component {
  render() {
    const {
      homeStore,
      foreignStore,
      bridgeMode,
      web3Store,
    } = this.props.RootStore
    const isNativeToErc = bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC
    const leftTitle = isNativeToErc ? (
      <FormattedMessage id="components.i18n.StatisticsPage.tokensDeposits" />
    ) : (
      <FormattedMessage id="components.i18n.StatisticsPage.tokensWithdraws" />
    )
    const rightTitle = isNativeToErc ? (
      <FormattedMessage id="components.i18n.StatisticsPage.tokensWithdraws" />
    ) : (
      <FormattedMessage id="components.i18n.StatisticsPage.tokensDeposits" />
    )
    const withoutEvents = false

    return withoutEvents ? (
      <Redirect to="/" />
    ) : (
      <div className="statistics-page">
        <div className="statistics-page-container">
          <div className="statistics-bridge-container">
            <span className="statistics-bridge-title statistics-title">
              <FormattedMessage id="components.i18n.StatisticsPage.bridgeStatistics" />
            </span>
            <BridgeStatistics
              users={
                homeStore.statistics.finished ? homeStore.statistics.users : ""
              }
              totalBridged={
                homeStore.statistics.finished
                  ? homeStore.statistics.totalBridged.toString()
                  : ""
              }
              homeBalance={homeStore.balance}
              homeSymbol={homeStore.symbol}
              homeNativeSupplyTitle={isNativeToErc}
              foreignSymbol={foreignStore.symbol}
              foreignSupply={foreignStore.totalSupply}
              foreignNetwork={foreignStore.networkName}
            />
          </div>
          {homeStore.depositFeeCollected.finished &&
            homeStore.withdrawFeeCollected.finished &&
            (homeStore.depositFeeCollected.shouldDisplay ||
              homeStore.withdrawFeeCollected.shouldDisplay) && (
              <FeeStatistics
                depositFeeCollected={homeStore.depositFeeCollected}
                withdrawFeeCollected={homeStore.withdrawFeeCollected}
              />
            )}
          <div className="statistics-transaction-container">
            <div className="statistics-deposit-container">
              <span className="statistics-deposit-title statistics-title">
                {leftTitle}
              </span>
              <TransactionsStatistics
                txNumber={
                  homeStore.statistics.finished
                    ? homeStore.statistics.deposits
                    : ""
                }
                type={foreignStore.symbol}
                value={
                  homeStore.statistics.finished
                    ? homeStore.statistics.depositsValue
                    : ""
                }
              />
            </div>
            <div className="statistics-withdraw-container">
              <span className="statistics-withdraw-title statistics-title">
                {rightTitle}
              </span>
              <TransactionsStatistics
                txNumber={
                  homeStore.statistics.finished
                    ? homeStore.statistics.withdraws
                    : ""
                }
                type={foreignStore.symbol}
                value={
                  homeStore.statistics.finished
                    ? homeStore.statistics.withdrawsValue
                    : ""
                }
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}
