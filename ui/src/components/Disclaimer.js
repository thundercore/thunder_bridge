import React from "react"
import disclaimerIcon from "../assets/images/disclaimer-modal/disclaimer@2x.png"
import { FormattedMessage } from "react-intl"

export const Disclaimer = ({ onConfirmation }) => (
  <div className="disclaimer-alert">
    <div className="alert-container">
      <span className="disclaimer-title">
        <FormattedMessage id="components.i18n.Disclaimer.welcome" />
        <br />
      </span>
      <p className="disclaimer-description">
        <br />
        <FormattedMessage id="components.i18n.Disclaimer.disclaimer1" />
        <br />
        <br />
        <FormattedMessage id="components.i18n.Disclaimer.disclaimer2" />
      </p>
      <div className="disclaimer-buttons">
        <button className="disclaimer-confirm" onClick={onConfirmation}>
          <FormattedMessage id="components.i18n.Disclaimer.gotIt" />
        </button>
      </div>
    </div>
  </div>
)
