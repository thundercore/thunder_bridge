import React from 'react'
import { DAI2SAI } from './utils/dai2sai'

export const BridgeForm = ({ reverse, currency, onTransfer, onAmountInputChange, onRecipientInputChange, displayArrow, recipient }) => (
  <div className="form-container">
    {displayArrow &&
      <div className={`transfer-line ${displayArrow ? 'transfer-right' : ''}`}>
        <div className="arrow" />
      </div>
    }
    <form className="bridge-form" onSubmit={onTransfer} autoComplete="off">
      <div className="bridge-form-controls">
        <div className="bridge-form-inputs">
          <div className="bridge-form-input-wrapper">
            <label htmlFor="amount" className="bridge-form-input-label">Amount</label>
            <div className="bridge-form-input-container">
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
                {DAI2SAI(currency)}
              </label>
            </div>
          </div>
          <div className="bridge-form-input-wrapper">
          <label htmlFor="recipient" className="bridge-form-input-label">Recipient</label>
            <div className="bridge-form-input-container">
              <input
                onChange={onRecipientInputChange}
                name="recipient"
                type="text"
                pattern="0x[0-9a-fA-F]{40}"
                className="bridge-form-input"
                id="recipient"
                placeholder="0x0"
                value={recipient}
              />
            </div>
          </div>
        </div>
        <div>
          <button type="submit" className="bridge-form-button">
            Transfer
          </button>
        </div>
      </div>
    </form>
  </div>
)
