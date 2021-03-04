import React from 'react'
import yn from './utils/yn'
import { DailyQuotaModal } from './DailyQuotaModal'
import { HeaderMenu } from './HeaderMenu'
import { Link } from 'react-router-dom'
import { MobileMenu } from './MobileMenu'
import { MobileMenuButton } from './MobileMenuButton'
import { inject, observer } from 'mobx-react/index'
import { ReactComponent as TTIcon } from "../assets/images/themes/core/logos/logo-home.svg"
import { ReactComponent as TTLogoIcon} from "../assets/images/themes/core/logos/logo-thundercore.svg"
import { bridgeType } from '../stores/utils/bridgeMode'

@inject('RootStore')
@observer
export class Header extends React.Component {
  render() {
    const {
      showMobileMenu,
      onMenuToggle,
      RootStore: { alertStore, web3Store }
    } = this.props
    const withoutEvents = true

    return (
      <header className="header">
        {showMobileMenu ? (
          <MobileMenu withoutEvents={withoutEvents} onMenuToggle={onMenuToggle} />
        ) : null}
        <div className="container">
          <div className="header-section">
            <Link to={`/${bridgeType}`} onClick={showMobileMenu ? onMenuToggle : null} className="header-logo-container">
              <TTIcon height={28} width={28}/>
              <TTLogoIcon className="header-logo"/>
              <div className="header-icon" />
            </Link>
            <MobileMenuButton onMenuToggle={onMenuToggle} showMobileMenu={showMobileMenu} />
          </div>
          <div className="header-section buttons">
            <HeaderMenu withoutEvents={withoutEvents} onMenuToggle={onMenuToggle} />
          </div>
        </div>
        {alertStore && alertStore.showDailyQuotaInfo && <DailyQuotaModal />}
      </header>
    )
  }
}
