import React from 'react'
import { MenuItems } from './MenuItems'
import { Wallet } from './Wallet'
import { TutorialIcon } from "./menu-icons"
import { bridgeType } from '../stores/utils/bridgeMode'

export const HeaderMenu = ({ withoutEvents }) => (
  <div className="header-menu">
    <MenuItems withoutEvents={withoutEvents} />
    <Wallet />
    <a href={`${bridgeType === "eth" ? "https://docs.thundercore.com/docs/ThunderStableCoinTutorial.pdf" : "https://docs.thundercore.com/docs/TransferringCrossChainAssets-BSC.pdf" }`}
      target="_blank"
      className="menu-items" onClick={withoutEvents.onMenuToggle}>
      <span className="menu-items-icon"><TutorialIcon/></span>
      <span className="menu-items-text">Tutorial</span>
    </a>
  </div>
)
