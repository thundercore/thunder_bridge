import React from 'react'
import CloseButton from '../assets/images/modal/close.png'
import BannerLogo from '../assets/images/modal/bannerLogo.jpg'
import { ReactComponent as TTLogoIcon } from '../assets/images/themes/core/logos/logo-thundercore.svg'
import { ReactComponent as TTIcon } from '../assets/images/themes/core/logos/logo-home.svg'
// import { ReactComponent as TTIcon } from "../assets/images/themes/core/logos/logo-home.svg"

export default function Banner({closeModal}) {
  return (
    <div className="banner-wrapper">
      <img className="close" src={CloseButton} onClick={closeModal} alt="close" />
      <div className="disclaimer-alert">
        <div className="content">
          <img className="banner-logo" alt="banner logo" src={BannerLogo} />
          <h2 className="h2">ThunderCore x BSC Coming Soon</h2>
          <p className="disclaimer-description">TT-Bridge will support Binance Smart Chain Network (BEP20) assets including BUSD, BNB, TT tokens this month. Stay tuned!</p>
        </div>
      <div className="banner-footer">
        <TTIcon height={16} width={16} style={{ marginRight: 4 }}/>
        <TTLogoIcon width={120}/>
      </div>
      </div>
  </div>
  )
}
