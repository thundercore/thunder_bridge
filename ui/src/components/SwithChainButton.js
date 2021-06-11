import React from "react"
import { bridgeType } from "../stores/utils/bridgeMode"
import { FormattedMessage } from "react-intl"

const textSelector = (chain) => {
  switch (chain) {
    case "eth":
      return (
        <FormattedMessage id="components.i18n.SwithChainButton.ethereumNetwork" />
      )
    case "bsc":
      return (
        <FormattedMessage id="components.i18n.SwithChainButton.bscNetwork" />
      )
    case "heco":
      return (
        <FormattedMessage id="components.i18n.SwithChainButton.hecoNetwork" />
      )
  }
}

const SwithChainButton = () => {
  const renderChains = ["eth", "bsc", "heco"].filter((n) => {
    return n !== bridgeType
  })
  console.log("renderChains", bridgeType, renderChains)

  const chainText1 = textSelector(renderChains[0])
  const chainText2 = textSelector(renderChains[1])
  const bridge1 = renderChains[0]
  const bridge2 = renderChains[1]

  return (
    <div className="switch-chain-container">
      <div className="switch-chain-wrapper">
        <a href={`${window.origin}/${bridge1}/`}>
          <button className="switch-chain-button" type="button">
            <span className="to">
              <FormattedMessage id="components.i18n.SwithChainButton.switchTo" />
            </span>
            <span className="text">{chainText1}</span>
          </button>
        </a>
      </div>
      <div className="switch-chain-wrapper">
        <a href={`${window.origin}/${bridge2}/`}>
          <button className="switch-chain-button" type="button">
            <span className="to">
              <FormattedMessage id="components.i18n.SwithChainButton.switchTo" />
            </span>
            <span className="text">{chainText2}</span>
          </button>
        </a>
      </div>
    </div>
  )
}

export default SwithChainButton
