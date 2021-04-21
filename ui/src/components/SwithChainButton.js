import React from "react"
import { bridgeType } from "../stores/utils/bridgeMode"
import { FormattedMessage } from "react-intl"

const SwithChainButton = () => {
  const bridgeText =
    bridgeType === "eth" ? (
      <FormattedMessage id="components.i18n.SwithChainButton.bscNetwork" />
    ) : (
      <FormattedMessage id="components.i18n.SwithChainButton.ethereumNetwork" />
    )
  const bridge = bridgeType === "eth" ? "bsc" : "eth"

  return (
    <div className="switch-chain-wrapper">
      <a href={`${window.origin}/${bridge}/`}>
        <button className="switch-chain-button" type="button">
          <span className="to">
            <FormattedMessage id="components.i18n.SwithChainButton.switchTo" />
          </span>
          <span className="text">{bridgeText}</span>
        </button>
      </a>
    </div>
  )
}

export default SwithChainButton
