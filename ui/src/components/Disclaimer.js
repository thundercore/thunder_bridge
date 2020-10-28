import React from 'react'
import disclaimerIcon from '../assets/images/disclaimer-modal/disclaimer@2x.png'

export const Disclaimer = ({ onConfirmation }) => (
  <div className="disclaimer-alert">
    <div className="alert-container">
      <span className="disclaimer-title">
      Welcome to ThunderBridge
        <br />
      </span>
      <p className="disclaimer-description">
        <br />
        Use of this app and the ThunderBridge is at your own risk. Users may experience unexpected
        delays, unexpected visual artifacts, unexpected loss of tokens or funds from improper app
        configuration, or other negative outcomes.
        <br />
        <br />
        By hitting the "continue" button, you are representing that you’ve read our
        <a
          href="https://www.thundercore.com/terms/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>{' '}
        in full, and that you agree to be legally bound by them.
      </p>
      <div className="disclaimer-buttons">
        <button className="disclaimer-confirm" onClick={onConfirmation}>
          Continue
        </button>
      </div>
    </div>
  </div>
)
