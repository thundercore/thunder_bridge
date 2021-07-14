import React from "react"
import { injectIntl, FormattedMessage } from "react-intl"

const TransferWarning = ({ onConfirmation, onCancel }) => {
  return (
    <div className="transfer-alert">
      <div className="alert-container">
        <div className="transfer-warning-title">
          <FormattedMessage id="components.i18n.TransferWarning.warning" />
        </div>
        <div className="transfer-warning-content">
          <div className="transfer-warning-content-up">
            <FormattedMessage id="components.i18n.TransferWarning.readRules" />
          </div>
          <div className="transfer-warning-content-down">
            <FormattedMessage id="components.i18n.TransferWarning.noExchangeAddress" />
          </div>
        </div>
        <div className="transfer-buttons">
          <button className="transfer-cancel" onClick={onCancel}>
            <FormattedMessage id="components.i18n.TransferAlert.cancel" />
          </button>
          <button className="transfer-confirm" onClick={onConfirmation}>
            <FormattedMessage id="components.i18n.TransferAlert.continue" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default injectIntl(TransferWarning)
