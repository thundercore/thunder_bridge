import React from "react"
import numeral from "numeral"
import { DataBlock } from "./DataBlock"
import { injectIntl } from "react-intl"

const TransactionsStatistics = ({ txNumber, value, type, intl }) => (
  <div className="statistics-bridge-data">
    <DataBlock
      description={intl.formatMessage({
        id: "components.i18n.TransactionsStatistics.transactions",
      })}
      value={numeral(txNumber).format("0,0 a")}
      type=""
    />
    <div className="separator" />
    <DataBlock
      description={intl.formatMessage({
        id: "components.i18n.TransactionsStatistics.totalValue",
      })}
      value={numeral(value).format("0,0.00 a", Math.floor)}
      type={type}
    />
  </div>
)

export default injectIntl(TransactionsStatistics)
