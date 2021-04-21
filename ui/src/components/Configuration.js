import React from "react"
import numeral from "numeral"
import { DataBlock } from "./DataBlock"
import { RenameToken } from "./utils/renameToken"
import { injectIntl } from "react-intl"

const Configuration = ({
  requiredSignatures,
  authorities,
  symbol,
  maxSingleDeposit,
  maxTotalBalance,
  intl,
}) => (
  <div className="status-configuration-data">
    <DataBlock
      description={intl.formatMessage({
        id: "components.i18n.Configuration.requiredSignatures",
      })}
      value={numeral(requiredSignatures).format("0")}
      type=""
    />
    <div className="separator" />
    <DataBlock
      description={intl.formatMessage({
        id: "components.i18n.Configuration.authorities",
      })}
      value={numeral(authorities).format("0")}
      type=""
    />
    {maxSingleDeposit &&
      maxSingleDeposit !== "0" && <div className="separator" /> && (
        <DataBlock
          description={intl.formatMessage({
            id: "components.i18n.Configuration.maxSingleDeposit",
          })}
          value={numeral(maxSingleDeposit).format("0.00 a", Math.floor)}
          type={symbol}
        />
      )}
    {maxSingleDeposit &&
      maxSingleDeposit !== "0" && <div className="separator" /> && (
        <DataBlock
          description={`${intl.formatMessage(
            {
              id: "components.i18n.Configuration.remainingDailyQuota",
            },
            { tokenName: RenameToken(symbol) }
          )}`}
          value={numeral(maxTotalBalance).format("0.00 a", Math.floor)}
          type={symbol}
        />
      )}
  </div>
)

export default injectIntl(Configuration)
