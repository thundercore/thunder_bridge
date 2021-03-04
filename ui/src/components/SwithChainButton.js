import React, { Component } from 'react'
import {bridgeType} from "../stores/utils/bridgeMode"

export default class SwithChainButton extends Component {

  bridgeText = bridgeType === "eth" ? "Binance Smart Chain Network" : "Ethereum Network"

  getUrl() {
    const env = process.env.NODE_ENV
    const bridge = process.env.REACT_APP_BRIDGE_TOKENS.toLowerCase().includes("eth") ? "bsc" : "eth"
    if (env === "development") return `https://bridge-venus.thundercore.com/${bridge}`
    return `https://bridge.thundercore.com/${bridge}`
  }

  render() {
    return (
      <div className="switch-chain-wrapper">
        <a href={this.getUrl()}><button className="switch-chain-button" type="button">
          <span className="to">Switch to</span>
          <span className="text">{this.bridgeText}</span></button></a>
      </div>
    )
  }
}
