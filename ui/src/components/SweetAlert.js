import React from 'react'
import swal from 'sweetalert'
import { inject, observer } from 'mobx-react'
import Web3Store from '../stores/Web3Store'
import { isMobile } from 'react-device-detect'

@inject('RootStore')
@observer
export class SweetAlert extends React.Component {
  componentWillReact() {
    const { alertStore } = this.props.RootStore

    if (alertStore.alerts.length > 0) {
      const alert = alertStore.alerts.slice()[0]
      const isWrongNetwork = alert.messageType == alertStore.WRONG_NETWORK_ERROR
      const isAddNetwork = isWrongNetwork && window.ethereum && window.ethereum.isMetaMask && !isMobile && alert.info.id !== 1 // check not eth network. For eth, check this PR: https://github.com/ethereum/EIPs/pull/3326
      const button = isAddNetwork ? {button: {text: `Switch to ${alert.info.name}`}} : {}
      const swalConfig = {...alert, ...button}
      swal(swalConfig).then((isButtonClicked) => {
        alertStore.remove(alert)
        if (isWrongNetwork) {
          this.handleNetwork(isAddNetwork, alert.info.id, isButtonClicked)
        }
      })
    }
  }

  handleNetwork(isAddNetwork, chainID, isButtonClicked) {
    if (isAddNetwork && isButtonClicked) {
      Web3Store.autoAddNetwork(chainID)
    } else {
      window.location.reload()
    }
  }

  logErrors() {
    const { alertStore } = this.props.RootStore
    const errors = alertStore.alerts.filter(alert => alert.type === 'error')
    if (errors.length) {
      console.log('Found errors:', errors.length)
    }
  }

  render() {
    this.logErrors()
    return <div style={{ display: 'none' }} />
  }
}
