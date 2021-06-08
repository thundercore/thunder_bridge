import React from "react"
import numeral from "numeral"
import { CopyIcon } from "./icons/CopyIcon"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { updateForeignLogo, valueFormatter } from "../stores/utils/utils"
import { RenameToken } from "./utils/renameToken"
import { injectIntl, FormattedMessage } from "react-intl"

const NetworkDetails = ({
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
  feeCurrency,
  intl,
}) => {
  const displayCurrency = RenameToken(currency)
  const networkTitle = isHome ? (
    <FormattedMessage id="components.i18n.NetworkDetails.bridgeHomeAddress" />
  ) : (
    <FormattedMessage id="components.i18n.NetworkDetails.bridgeForeignAddress" />
  )
  const logoClass = isHome
    ? "home-logo home-logo-modal"
    : "foreign-logo foreign-logo-modal"
  const totalTitle = isHome
    ? nativeSupplyTitle
      ? intl.formatMessage({
          id: "components.i18n.BridgeStatistics.nativeToken",
        })
      : intl.formatMessage({
          id: "components.i18n.BridgeStatistics.totalMinted",
        })
    : `${displayCurrency} ${intl.formatMessage({
        id: "components.i18n.BridgeStatistics.tokensAmount",
      })}`
  const totalAmount = isHome ? totalBalance : totalSupply

  return (
    <div className="network-details" data-testid="network-details">
      <div className="details-logo-container">
        <div className={logoClass} style={!isHome ? updateForeignLogo() : {}} />
      </div>
      <div className="details-body">
        <p className="details-data-container">
          <span className="details-label">
            <FormattedMessage id="components.i18n.NetworkDetails.network" />
          </span>
          <span className="details-description-black">{url}</span>
        </p>
        <p className="details-data-container">
          <span className="details-label">{networkTitle}</span>
          <span className="details-description details-copy">
            <a
              className="details-description"
              href={getExplorerAddressUrl(address)}
              target="_blank"
            >
              {address.slice(0, 27).concat("...")}
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
            <span className="details-label">
              <FormattedMessage
                id="components.i18n.Configuration.remainingDailyQuota"
                values={{ tokenName: displayCurrency }}
              />
            </span>
            <span className="details-description-black">
              {valueFormatter(maxCurrentLimit)} {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && (
          <p className="details-data-container">
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.maxAmountPerTx" />
            </span>
            <span className="details-description-black">
              {valueFormatter(maxPerTx)} {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && (
          <p className="details-data-container">
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.minAmountPerTx" />
            </span>
            <span className="details-description-black">
              {Number(minPerTx)
                .toFixed(5)
                .replace(/(\.0+|0+)$/, "")}{" "}
              {displayCurrency}
            </span>
          </p>
        )}
        {displayBridgeLimits && fixedFee && (
          <p className="details-data-container">
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.minFee" />
            </span>
            <span className="details-description-black">
              {Number(fixedFee)
                .toFixed(5)
                .replace(/(\.0+|0+)$/, "")}{" "}
              {RenameToken(feeCurrency)}
            </span>
          </p>
        )}
        {displayBridgeLimits && feePercent && (
          <p className="details-data-container">
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.feePercent" />
            </span>
            <span className="details-description-black">
              {numeral(feePercent).format("0,0.0", Math.floor)} %
            </span>
          </p>
        )}
        {displayTokenAddress && (
          <p className="details-data-container">
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.tokenAddress" />
            </span>
            <span className="details-description details-copy">
              <a
                className="details-description"
                href={getExplorerAddressUrl(tokenAddress)}
                target="_blank"
              >
                {tokenAddress.slice(0, 27).concat("...")}
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
            <span className="details-label">
              <FormattedMessage id="components.i18n.NetworkDetails.tokenName" />
            </span>
            <span className="details-description-black">
              {RenameToken(tokenName) || "No token name"}
            </span>
          </p>
        )}
        <p className="details-data-container">
          <span className="details-label">{totalTitle}</span>
          <span className="details-description-black">
            {Number(totalAmount)
              .toFixed(5)
              .replace(/(\.0+|0+)$/, "")}{" "}
            {displayCurrency}
          </span>
        </p>
        <p className="details-data-container">
          <span className="details-label">
            <FormattedMessage
              id="components.i18n.NetworkDetails.yourBalance"
              values={{ tokenName: displayCurrency }}
            />
          </span>
          <span className="details-description-black">
            {valueFormatter(balance)} {displayCurrency}
          </span>
        </p>
      </div>
    </div>
  )
}

export default injectIntl(NetworkDetails)
