import React, { useState, useEffect } from "react";
import { Providers as EcoProviders, Navbar as EcoHeaders, Footer } from '@thundercore/eco-lib'
import {
  Header,
  Bridge,
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
import { useIntl } from "react-intl";
import Banner from "./components/Banner";
import SwithChainButton from "./components/SwithChainButton";
import NotFound from "./components/NotFound";
import { LocaleProvider } from "./contexts/localeContext";

export default function AppProviders() {
  return (
    <LocaleProvider>
      <App />
    </LocaleProvider>
  );
}

function App() {
  const [showDisclaimer, setshowDisclaimer] = useState(false);
  const [isBannerOpen, setisBannerOpen] = useState(false);
  const intl = useIntl();

  useEffect(() => {
    const disclaimerDisplayed = getItem(DISCLAIMER_KEY);

    if (!disclaimerDisplayed) {
      setshowDisclaimer(true);
    }
  }, []);

  const closeDisclaimer = () => {
    setItem(DISCLAIMER_KEY, true);
    setshowDisclaimer(false);
  };

  return (
    <div>
    <EcoProviders>
      <EcoHeaders hasEntity notOpacity hideLangSelect locale={intl.locale} updateLocale={() => {}} />
      <Route component={Loading} />
      <Route component={SweetAlert} />
      <Route render={() => <Header />} />
      <div className="app-container">
        <SwithChainButton />
        <Switch>
          {/* <Route exact path="/events" component={RelayEvents} /> */}
          <Route
            exact
            path={["/status", "/(eth|bsc|heco)/status"]}
            component={StatusPage}
          />
          <Route
            exact
            path={["/statistics", "/(eth|bsc|heco)/statistics"]}
            component={StatisticsPage}
          />
          <Route exact path={["/", "/(eth|bsc|heco)"]} component={Bridge} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <ModalContainer showModal={showDisclaimer}>
        <Disclaimer onConfirmation={closeDisclaimer} />
      </ModalContainer>
      <ModalContainer showModal={isBannerOpen}>
        <Banner closeModal={() => setisBannerOpen(false)} />
      </ModalContainer>
      <NoWallet showModal={!showDisclaimer} />
      <Footer locale={intl.locale} />
    </EcoProviders>
    </div>
  );
}
