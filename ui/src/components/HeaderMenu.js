import React from "react"
import { default as MenuItems } from "./MenuItems"
import { Wallet } from "./Wallet"

import { bridgeType } from "../stores/utils/bridgeMode"
import { FormattedMessage } from "react-intl"

export const HeaderMenu = () => (
  <div className="header-menu">
    <MenuItems />
    <a
      href={`${
        bridgeType === "eth"
          ? "https://thundercore.zendesk.com/hc/en-us/articles/4402401778841-ThunderCore-Bridge-Transferring-into-ThunderCore-from-Ethereum"
          : bridgeType === "bsc"
          ? "https://thundercore.zendesk.com/hc/en-us/articles/4402401303577-ThunderCore-Bridge-Transferring-into-ThunderCore-from-Binance-Smart-Chain-"
          : "https://thundercore.zendesk.com/hc/en-us/articles/4402658518169"
      }`}
      target="_blank"
      className="menu-items"
    >
      <span className="menu-items-text">
        <FormattedMessage id="components.i18n.HeaderMenu.tutorial" />
      </span>
    </a>
    <a
      href={`${
        bridgeType === "eth"
          ? "https://thundercore.zendesk.com/hc/en-us/articles/4402401778841-ThunderCore-Bridge-Transferring-into-ThunderCore-from-Ethereum"
          : bridgeType === "bsc"
          ? "https://thundercore.zendesk.com/hc/en-us/articles/4402401303577-ThunderCore-Bridge-Transferring-into-ThunderCore-from-Binance-Smart-Chain-"
          : "https://thundercore.zendesk.com/hc/en-us/articles/4402658518169"
      }`}
      target="_blank"
      className="menu-items"
    >
      <span className="menu-items-text">
        <FormattedMessage id="components.i18n.HeaderMenu.tutorial" />
      </span>
    </a>
    <Wallet />
  </div>
)
