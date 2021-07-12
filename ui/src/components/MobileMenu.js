import React from "react"
import { default as MenuItems } from "./MenuItems"
import { TutorialIcon } from "./menu-icons"
import { bridgeType } from "../stores/utils/bridgeMode"
import { FormattedMessage } from "react-intl"

export const MobileMenu = ({ onMenuToggle, withoutEvents }) => (
  <div className="mobile-menu">
    <div className="mobile-menu-links">
      <MenuItems withoutEvents={withoutEvents} onMenuToggle={onMenuToggle} />
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
        onClick={withoutEvents.onMenuToggle}
      >
        <span className="menu-items-icon">
          <TutorialIcon />
        </span>
        <span className="menu-items-text">
          <FormattedMessage id="components.i18n.HeaderMenu.tutorial" />
        </span>
      </a>
    </div>
  </div>
)
