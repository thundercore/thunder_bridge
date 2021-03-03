import React from 'react'

export default function Banner({closeModal}) {
  return (
    <div className="disclaimer-alert">
    <div className="alert-container">
      <span className="disclaimer-title">
      Banner here
      </span>
      {/* <p className="disclaimer-description"></p> */}
      <div className="disclaimer-buttons">
      <button className="disclaimer-confirm" type="button" onClick={closeModal}>Close</button>
      </div>
    </div>
  </div>
  )
}
