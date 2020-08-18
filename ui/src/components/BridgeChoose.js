import React from 'react'
import { DAI2SAI } from './utils/dai2sai'

export const BridgeChoose = (props) => {
  const chooseItems = [
    {
      from: 'DAI',
      to: 'TT-DAI'
    },
    {
      from: 'TT-DAI',
      to: 'DAI'
    },
    {
      from: 'USDT',
      to: 'TT-USDT'
    },
    {
      from: 'TT-USDT',
      to: 'USDT'
    }
  ]

  const chooseLogoClass = (c) => {
    return 'bridge-choose-logo logo-' + c.toLowerCase()
  }

  const handleOptionChange = (mode) => {
    if (props.web3Store.metamaskNet.id === props.web3Store.foreignNet.id) {
      if (mode.from.substring(0,3) === 'TT-') {
        props.alert.pushError(
          `Please, change network to ${props.web3Store.homeNet.name} to transfer ${DAI2SAI(mode.from)}`
        )
      } else {
        props.alert.setLoading(true)
        props.setNewTokenHandler(mode.from)
      }
    } else {
      if (mode.from.substring(0,3) !== 'TT-') {
        props.alert.pushError(
          `Please, change network to ${props.web3Store.foreignNet.name} to transfer ${DAI2SAI(mode.from)}`
        )
      } else {
        props.alert.setLoading(true)
        props.setNewTokenHandler(mode.to)
      }
    }
  }

  const handleChecked = (item) => {
    if (props.isHome) {
      if (item.to === props.foreignStore.symbol) {
        return true
      }
    } else {
      if (item.from === props.foreignStore.symbol) {
        return true
      }
    }
  }


  return (
    <div className="bridge-choose">
      {chooseItems.map((item, index) => {
        return (
          <label key={index} className="bridge-choose-button">
            <input
              name="choose"
              type="radio"
              className="bridge-choose-radio"
              onChange={() => handleOptionChange(item)}
              checked={handleChecked(item)}
            />
            <span className="bridge-choose-container">
              <span className="bridge-choose-logo-container">
                <span className={chooseLogoClass(item.from)} />
              </span>
              <span className="bridge-choose-text">
                {DAI2SAI(item.from)} <i className="bridge-choose-arrow" /> {DAI2SAI(item.to)}
              </span>
              <span className="bridge-choose-logo-container">
                <span className={chooseLogoClass(item.to)} />
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
