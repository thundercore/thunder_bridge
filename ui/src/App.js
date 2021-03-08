import React from "react";
import {
  Header,
  Bridge,
  RelayEvents,
  Footer,
  SweetAlert,
  Loading,
  StatusPage,
  StatisticsPage,
} from "./components";
import { Route, Switch } from "react-router-dom";
import "./assets/stylesheets/application.css";
import { Disclaimer } from "./components";
import { ModalContainer } from "./components";
import { NoWallet } from "./components";
import {
  setItem,
  getItem,
  DISCLAIMER_KEY,
} from "./components/utils/localstorage";
import Banner from "./components/Banner";
import SwithChainButton from "./components/SwithChainButton";
import NotFound from "./components/NotFound";

class App extends React.Component {
  state = {
    showDisclaimer: false,
    showMobileMenu: false,
    isBannerOpen: true,
  };

  componentDidMount() {
    const disclaimerDisplayed = getItem(DISCLAIMER_KEY);

    if (!disclaimerDisplayed) {
      this.setState({ showDisclaimer: true });
    }
  }

  closeDisclaimer = () => {
    setItem(DISCLAIMER_KEY, true);
    this.setState({ showDisclaimer: false });
  };

  toggleMobileMenu = () => {
    this.setState((prevState) => ({
      showMobileMenu: !prevState.showMobileMenu,
    }));
  };

  render() {
    const { showDisclaimer, showMobileMenu, isBannerOpen } = this.state;
    return (
      <div className={showMobileMenu ? "mobile-menu-is-open" : ""}>
        <Route component={Loading} />
        <Route component={SweetAlert} />
        <Route
          render={() => (
            <Header
              onMenuToggle={this.toggleMobileMenu}
              showMobileMenu={showMobileMenu}
            />
          )}
        />
        <div className="app-container">
          {/* <SwithChainButton /> */}
          {showMobileMenu && (
            <Route render={() => <div className="mobile-menu-open" />} />
          )}
          <Switch>
            {/* <Route exact path="/events" component={RelayEvents} /> */}
            <Route
              exact
              path={["/status", "/(eth|bsc)/status"]}
              component={StatusPage}
            />
            <Route
              exact
              path={["/statistics", "/(eth|bsc)/statistics"]}
              component={StatisticsPage}
            />
            <Route exact path={["/", "/(eth|bsc)"]} component={Bridge} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <Route component={Footer} />
        <ModalContainer showModal={showDisclaimer}>
          <Disclaimer onConfirmation={this.closeDisclaimer} />
        </ModalContainer>
        <ModalContainer showModal={isBannerOpen}>
          <Banner closeModal={() => this.setState({ isBannerOpen: false })} />
        </ModalContainer>
        <NoWallet showModal={!showDisclaimer} />
      </div>
    );
  }
}

export default App;
