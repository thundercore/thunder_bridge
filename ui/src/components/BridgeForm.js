import React from "react"
import { RenameToken } from "./utils/renameToken"
import { FormattedMessage } from "react-intl"
import numeral from "numeral"
import { valueFormatter } from "../stores/utils/utils"
import Exclamation from "../assets/images/logos/exclamation-circle.png"

export const BridgeForm = ({
  reverse,
  currency,
  onTransfer,
  onAmountInputChange,
  onRecipientInputChange,
  displayArrow,
  recipient,
  placeHolder,
  error,
  maxCurrentDeposit,
  maxPerTx,
  minPerTx,
  buttonEnabled,
}) => (
  <div className="form-container">
    {displayArrow && (
      <div className={`transfer-line ${displayArrow ? "transfer-right" : ""}`}>
        <div className="arrow" />
      </div>
    )}
    <form className="bridge-form" onSubmit={onTransfer} autoComplete="off">
      <div className="bridge-form-controls">
        <div className="bridge-form-inputs">
          <div className="bridge-form-input-wrapper">
            <label htmlFor="amount" className="bridge-form-input-label">
              <FormattedMessage id="components.i18n.BridgeForm.amount" />
            </label>
            <div
              className={
                error.enable
                  ? "bridge-form-input-container-error"
                  : "bridge-form-input-container"
              }
            >
              <input
                onChange={onAmountInputChange}
                name="amount"
                pattern="[0-9]+([.][0-9]{1,18})?"
                type="text"
                className="bridge-form-input"
                id="amount"
                placeholder="0"
              />
              <label htmlFor="amount" className="bridge-form-label">
                {RenameToken(currency)}
              </label>
            </div>
            <div className="bridge-form-input-wrapper-error">{error.text}</div>
            <div className="threshold-text-body">
              <p className="threshold-container">
                <span className="threshold-label">
                  <FormattedMessage
                    id="components.i18n.Configuration.remainingDailyQuota"
                    values={{ tokenName: RenameToken(currency) }}
                  />
                </span>
                <span className="threshold-description">
                  {valueFormatter(maxCurrentDeposit)} {RenameToken(currency)}
                </span>
              </p>
              <p className="threshold-container">
                <span className="threshold-label">
                  <FormattedMessage id="components.i18n.NetworkDetails.maxAmountPerTx" />
                </span>
                <span className="threshold-description">
                  {numeral(maxPerTx).format("0,0", Math.floor)}{" "}
                  {RenameToken(currency)}
                </span>
              </p>
              <p className="threshold-container">
                <span className="threshold-label">
                  <FormattedMessage id="components.i18n.NetworkDetails.minAmountPerTx" />
                </span>
                <span className="threshold-description">
                  {numeral(minPerTx).format("0,0", Math.floor)}{" "}
                  {RenameToken(currency)}
                </span>
              </p>
            </div>
          </div>
          <div className="bridge-form-input-wrapper">
            <label htmlFor="recipient" className="bridge-form-input-label">
              <FormattedMessage id="components.i18n.BridgeForm.recipient" />
            </label>
            <div className="bridge-form-input-container">
              <input
                onChange={onRecipientInputChange}
                name="recipient"
                type="text"
                pattern="0x[0-9a-fA-F]{40}"
                className="bridge-form-input"
                id="recipient"
                placeholder={placeHolder}
                value={recipient}
              />
            </div>
            <div className="bridge-form-input-wrapper-warning">
              <img
                className="bridge-form-input-wrapper-exclamation"
                src={Exclamation}
                alt="exclamation"
              />
              <div>
                <FormattedMessage id="components.i18n.BridgeForm.warningExchangeWallet" />
              </div>
            </div>
          </div>
        </div>
        <div>
          {buttonEnabled ? (
            <button type="submit" className="bridge-form-button">
              <FormattedMessage id="components.i18n.BridgeForm.transferButtonText" />
            </button>
          ) : (
            <button type="submit" className="bridge-form-disabled-button">
              <FormattedMessage id="components.i18n.BridgeForm.transferButtonText" />
            </button>
          )}
        </div>
      </div>
    </form>
  </div>
)
