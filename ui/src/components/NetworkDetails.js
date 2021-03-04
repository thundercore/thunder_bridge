import React from 'react'
import numeral from 'numeral'
import { CopyIcon } from './icons/CopyIcon'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { updateForeignLogo } from '../stores/utils/utils'
import { RenameToken } from './utils/renameToken'

export const NetworkDetails = ({
  isHome,
  networkData,
  url,
  logo,
  address,
  currency,
  maxCurrentLimit,
  maxPerTx,
  minPerTx,
  tokenAddress,
  totalSupply,
  totalBalance,
  balance,
  displayTokenAddress,
  displayBridgeLimits,
  nativeSupplyTitle,
  tokenName,
  getExplorerAddressUrl,
  fixedFee,
  feePercent,
  feeCurrency
}) => {
  const displayCurrency = RenameToken(currency)
  const networkTitle = isHome ? 'Bridge Home' : 'Bridge Foreign'
  const logoClass = isHome ? 'home-logo home-logo-modal' : 'foreign-logo foreign-logo-modal'
  const totalTitle = isHome
    ? nativeSupplyTitle
      ? `Native Coins Amount`
      : `Totally minted by the bridge`
    : `${displayCurrency} Tokens Amount`
  const totalAmount = isHome ? totalBalance : totalSupply
  const formattedBalance = isNaN(numeral(balance).format('0.00', Math.floor))
    ? numeral(0).format('0,0.00', Math.floor)
    : numeral(balance).format('0,0.000', Math.floor)

  return (
    <div className="network-details" data-testid="network-details">
      <div className="details-logo-container">
        <div className={logoClass} style={!isHome ? updateForeignLogo() : {}} />
      </div>
      <div className="details-body">
        <p className="details-data-container">
          <span className="details-label">Network</span>
          <span className="details-description">{url}</span>
        </p>
        <p className="details-data-container">
          <span className="details-label">{networkTitle} Address</span>
          <span className="details-description details-copy">
            <a
              className="details-description"
              href={getExplorerAddressUrl(address)}
              target="_blank"
            >
              {address.slice(0, 27).concat('...')}
            </a>
            <CopyToClipboard text={address}>
              <span className="copy-icon copy-icon-right">
                <CopyIcon />
              </span>
            </CopyToClipboard>
          </span>
        </p>
        {displayBridgeLimits && (
          <p className="details-data-container">
            <span className="details-label">Remaining Daily {displayCurrency} Quota</span>
            <span className="details-description-black">
              {numeral(maxCurrentLimit).format('0,0.0', Math.floor)} {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && (
          <p className="details-data-container">
            <span className="details-label">Maximum Amount Per Transaction</span>
            <span className="details-description-black">
              {numeral(maxPerTx).format('0,0.0', Math.floor)} {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && (
          <p className="details-data-container">
            <span className="details-label">Minimum Amount Per Transaction</span>
            <span className="details-description-black">
              {numeral(minPerTx).format('0,0.000', Math.floor)} {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && fixedFee && (
          <p className="details-data-container">
            <span className="details-label">Minimum Fee</span>
            <span className="details-description-black">
              {numeral(fixedFee).format('0,0.000', Math.floor)} {RenameToken(feeCurrency)}
            </span>
          </p>
        )}
        {displayBridgeLimits && feePercent && (
          <p className="details-data-container">
            <span className="details-label">Fee Percent</span>
            <span className="details-description-black">
              {numeral(feePercent).format('0,0.0', Math.floor)} %
            </span>
          </p>
        )}
        {displayTokenAddress && (
          <p className="details-data-container">
            <span className="details-label">Token Address</span>
            <span className="details-description details-copy">
              <a
                className="details-description"
                href={getExplorerAddressUrl(tokenAddress)}
                target="_blank"
              >
                {tokenAddress.slice(0, 27).concat('...')}
              </a>
              <CopyToClipboard text={tokenAddress}>
                <span className="copy-icon copy-icon-right">
                  <CopyIcon />
                </span>
              </CopyToClipboard>
            </span>
          </p>
        )}
        {displayTokenAddress && (
          <p className="details-data-container">
            <span className="details-label">Token Name</span>
            <span className="details-description-black">{RenameToken(tokenName) || 'No token name'}</span>
          </p>
        )}
        <p className="details-data-container">
          <span className="details-label">{totalTitle}</span>
          <span className="details-description-black">
            {numeral(totalAmount).format('0,0.000', Math.floor)} {displayCurrency}
          </span>
        </p>
        <p className="details-data-container">
          <span className="details-label">Your {displayCurrency} Balance</span>
          <span className="details-description-black">
            {formattedBalance} {displayCurrency}
          </span>
        </p>
      </div>
    </div>
  )
}
