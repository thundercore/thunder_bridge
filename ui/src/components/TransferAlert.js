import React from 'react'
import arrowsIcon from '../assets/images/transfer-modal/icon-arrows@2x.png'
import numeral from 'numeral'
import { ArrowRight } from './icons/ArrowRight'
import { DAI2SAI } from './utils/dai2sai'

export const TransferAlert = ({
  onConfirmation,
  onCancel,
  from,
  to,
  fromCurrency,
  toCurrency,
  fromAmount,
  toAmount,
  fee,
  reverse,
  recipient,
  minPerTx,
  feeCurrency
}) => {
  const formattedFromAmount = numeral(fromAmount).format('0,0[.][000000000000000000]', Math.floor)
  const formattedToAmount = numeral(toAmount).format('0,0[.][000000000000000000]', Math.floor)

  return (
    <div className="transfer-alert">
      <div className="alert-container">
        <div className="transfer-title">
          <div className="alert-logo-box">
            <div className={reverse ? 'foreign-logo' : 'home-logo'} />
          </div>
          <div>
            <strong>{formattedFromAmount}</strong> {DAI2SAI(fromCurrency)}
          </div>
          <ArrowRight />
          <div>
            <strong>{formattedToAmount}</strong> {DAI2SAI(toCurrency)}
          </div>
          <div className="alert-logo-box">
            <div className={reverse ? 'home-logo' : 'foreign-logo'} />
          </div>
        </div>
        <p className="transfer-description" data-testid="transfer-description">
          <strong>{recipient && `Recipient: ${recipient}`}</strong><br />
          <strong>{`Transaction fee: ${fee} ${DAI2SAI(feeCurrency)}`}</strong>
        </p>
        <p className="transfer-description" data-testid="transfer-description">
          Please confirm that you would like to send <strong>{formattedFromAmount}</strong>{' '}
          {DAI2SAI(fromCurrency)} from {from} to receive <strong>{formattedToAmount}</strong> {DAI2SAI(toCurrency)} on{' '}
          {to}.
        </p>
        <div className="transfer-buttons">
          <button className="transfer-confirm" onClick={onConfirmation}>
            Continue
          </button>
          <button className="transfer-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
