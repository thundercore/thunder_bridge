import React from "react"
import numeral from "numeral"
import { InfoIcon } from "./icons/InfoIcon"
import { RenameToken } from "./utils/renameToken"
import { updateForeignLogo } from "../stores/utils/utils"
import { injectIntl, FormattedMessage } from "react-intl"

const BridgeNetwork = ({
  balance,
  currency,
  isHome,
  networkSubtitle,
  networkTitle,
  showModal,
  side,
  intl,
}) => {
  const containerName = isHome ? "home" : "foreign"
  const formattedBalance = isNaN(numeral(balance).format("0.00", Math.floor))
    ? numeral(0).format("0,0.00", Math.floor)
    : numeral(balance).format("0,0.00", Math.floor)
  const showMore = (
    <div className="bridge-network-data">
      <span className="info-icon" onClick={showModal}>
        <InfoIcon />
      </span>
    </div>
  )

  return (
    <div className={`network-container-${side}`}>
      {side === "left" && showMore}
      <div className="network-container">
        <div className="network-logo-container">
          <div
            className={`network-logo ${containerName}-logo`}
            style={containerName === "foreign" ? updateForeignLogo() : {}}
          />
        </div>
        <p className="text">
          <span className="network-basic-label">{`${
            side === "left"
              ? intl.formatMessage({
                  id: "components.i18n.BridgeNetwork.from",
                })
              : intl.formatMessage({
                  id: "components.i18n.BridgeNetwork.to",
                })
          }`}</span>
          <span className="network-title">{networkTitle}</span>
          {networkSubtitle ? (
            <span className="network-name">{networkSubtitle}</span>
          ) : null}
        </p>
        <div className="network-basic-label">
          <FormattedMessage id="components.i18n.BridgeNetwork.balance" />
        </div>
        <div className="network-balance">
          {formattedBalance}{" "}
          <span className="network-balance-currency">
            {RenameToken(currency)}
          </span>
        </div>
      </div>
      {side === "right" && showMore}
    </div>
  )
}

export default injectIntl(BridgeNetwork)
