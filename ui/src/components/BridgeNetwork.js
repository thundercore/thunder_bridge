import React from 'react'
import numeral from 'numeral'
import { InfoIcon } from './icons/InfoIcon'
import { RenameToken } from './utils/renameToken'

export const BridgeNetwork = ({
  balance,
  currency,
  isHome,
  networkSubtitle,
  networkTitle,
  showModal,
  side
}) => {
  const containerName = isHome ? 'home' : 'foreign'
  const formattedBalance = isNaN(numeral(balance).format('0.00', Math.floor))
    ? numeral(0).format('0,0.00', Math.floor)
    : numeral(balance).format('0,0.00', Math.floor)
  const showMore = (
    <div className="bridge-network-data" onClick={showModal}>
      <span className="info-icon">
        <InfoIcon />
      </span>
    </div>
  )

  return (
    <div className={`network-container-${side}`}>
      {side === 'left' &&
        showMore
      }
      <div className="network-container">
        <div className="network-logo-container">
          <div className={`network-logo ${containerName}-logo`} />
        </div>
        <p className="text">
          <span className="network-basic-label">{`${side === 'left' ? `From` : 'To'}`}</span>
          <span className="network-title">{networkTitle}</span>
          {networkSubtitle ? <span className="network-name">{networkSubtitle}</span> : null}
        </p>
        <div className="network-basic-label">Balance</div>
        <div className="network-balance">
          {formattedBalance} <span className="network-balance-currency">{RenameToken(currency)}</span>
        </div>
      </div>
      {side === 'right' &&
        showMore
      }
    </div>
  )
}
