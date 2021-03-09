import React from 'react'
import { MenuItems } from './MenuItems'
import {TutorialIcon} from "./menu-icons"
import { bridgeType } from '../stores/utils/bridgeMode'

export const MobileMenu = ({ onMenuToggle, withoutEvents }) => (
  <div className="mobile-menu">
    <div className="mobile-menu-links">
      <MenuItems withoutEvents={withoutEvents} onMenuToggle={onMenuToggle} />
      <a href={`${bridgeType === "eth" ? "https://docs.thundercore.com/docs/ThunderStableCoinTutorial.pdf" : "https://docs.thundercore.com/docs/TransferringCrossChainAssets-BSC.pdf" }`}
         target="_blank"
         className="menu-items" onClick={withoutEvents.onMenuToggle}>
        <span className="menu-items-icon"><TutorialIcon/></span>
        <span className="menu-items-text">Tutorial</span>
      </a>
    </div>
  </div>
)
