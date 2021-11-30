import React from "react";
import { DailyQuotaModal } from "./DailyQuotaModal";
import { HeaderMenu } from "./HeaderMenu";
import { Link } from "react-router-dom";
import { inject, observer } from "mobx-react/index";
// import yn from "./utils/yn"
// import { MobileMenu } from "./MobileMenu"
// import { MobileMenuButton } from "./MobileMenuButton"
// import { ReactComponent as TTIcon } from "../assets/images/themes/core/logos/logo-home.svg"
// import { ReactComponent as TTLogoIcon } from "../assets/images/themes/core/logos/logo-thundercore.svg"

@inject("RootStore")
@observer
export class Header extends React.Component {
  render() {
    const {
      RootStore: { alertStore, web3Store },
    } = this.props;

    return (
      <header className="header">
        <div className="container">
          <div className="header-section">
            <Link className="header-logo-container">
              <div className="header-icon" />
            </Link>
          </div>
          <div className="header-section buttons">
            <HeaderMenu />
          </div>
        </div>
        {alertStore && alertStore.showDailyQuotaInfo && <DailyQuotaModal />}
      </header>
    );
  }
}
