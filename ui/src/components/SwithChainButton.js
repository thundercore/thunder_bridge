import React from 'react'
import {bridgeType} from "../stores/utils/bridgeMode"
import {withRouter } from 'react-router-dom'

const SwithChainButton = (props) => {
  const bridgeText = bridgeType === "eth" ? "Binance Smart Chain Network" : "Ethereum Network"
  const bridge = bridgeType === "eth" ? "bsc" : "eth"

  return (
    <div className="switch-chain-wrapper">
      <a href={`${window.origin}/${bridge}`}><button className="switch-chain-button" type="button">
        <span className="to">Switch to</span>
        <span className="text">{bridgeText}</span></button></a>
    </div>
  )
}

export default withRouter(SwithChainButton)
