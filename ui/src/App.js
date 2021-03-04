import React from 'react'
import {
  Header,
  Bridge,
  RelayEvents,
  Footer,
  SweetAlert,
  Loading,
  StatusPage,
  StatisticsPage
} from './components'
import { Route, Switch, withRouter } from 'react-router-dom'
import './assets/stylesheets/application.css'
import { Disclaimer } from './components'
import { ModalContainer } from './components'
import { NoWallet } from './components'
import { setItem, getItem, DISCLAIMER_KEY } from './components/utils/localstorage'
import Banner from './components/Banner'
import SwithChainButton from './components/SwithChainButton'
import {bridgeType} from './stores/utils/bridgeMode'

class App extends React.Component {
  state = {
    showDisclaimer: false,
    showMobileMenu: false,
    isBannerOpen: true
  }

  handleSubpath(history) {
    const {pathname} = window.location
    const subpath = pathname.split("/")[1]
    if (subpath && subpath !== bridgeType) {
      const newPath = pathname.replace(subpath, bridgeType)
      history.push(newPath)
    }
  }

  componentDidMount() {
    const {history}= this.props
    this.handleSubpath(history)

    const disclaimerDisplayed = getItem(DISCLAIMER_KEY)

    if (!disclaimerDisplayed) {
      this.setState({ showDisclaimer: true })
    }
  }

  closeDisclaimer = () => {
    setItem(DISCLAIMER_KEY, true)
    this.setState({ showDisclaimer: false })
  }

  toggleMobileMenu = () => {
    this.setState(prevState => ({ showMobileMenu: !prevState.showMobileMenu }))
  }

  render() {
    const { showDisclaimer, showMobileMenu, isBannerOpen } = this.state
    return (
      <div className={showMobileMenu ? 'mobile-menu-is-open' : ''}>
        <Route component={Loading} />
        <Route component={SweetAlert} />
        <Route
          render={() => (
            <Header onMenuToggle={this.toggleMobileMenu} showMobileMenu={showMobileMenu} />
          )}
        />
        <div className="app-container">
          {/* <SwithChainButton /> */}
          {showMobileMenu && <Route render={() => <div className="mobile-menu-open" />} />}
          <Switch>
            { /* <Route exact path="/events" component={RelayEvents} /> */ }
            <Route exact path={["/status", "/:id/status"]} component={StatusPage} />
            <Route exact path={["/statistics", "/:id/statistics"]} component={StatisticsPage} />
            <Route path={"/"} component={Bridge} />
          </Switch>
        </div>
        <Route component={Footer} />
        <ModalContainer showModal={showDisclaimer}>
          <Disclaimer onConfirmation={this.closeDisclaimer} />
        </ModalContainer>
        <ModalContainer showModal={isBannerOpen}>
          <Banner closeModal={() => this.setState({isBannerOpen: false})} />
        </ModalContainer>
        <NoWallet showModal={!showDisclaimer} />
      </div>
    )
  }
}

export default withRouter(App)