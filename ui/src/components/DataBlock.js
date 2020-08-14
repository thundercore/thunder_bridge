import React from 'react'
import { DAI2SAI } from './utils/dai2sai'

export const DataBlock = ({ description, value, type, dataTestid }) => (
  <div className="datablock-container" data-testid={dataTestid}>
    <p>
      <span className="datablock-value">{value}</span>
      <span className={type ? 'datablock-type' : ''}>{DAI2SAI(type)}</span>
    </p>
    <p className="datablock-description">{description}</p>
  </div>
)
