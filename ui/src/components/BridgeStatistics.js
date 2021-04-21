import React from "react"
import numeral from "numeral"
import { DataBlock } from "./DataBlock"
import { RenameToken } from "./utils/renameToken"
import { injectIntl } from "react-intl"

const checkSymbol = (symbol) => {
  return symbol === "TT" ? RenameToken("BEP20-TT") : symbol
}

const BridgeStatistics = ({
  users,
  totalBridged,
  homeBalance,
  homeNativeSupplyTitle,
  foreignSupply,
  homeSymbol,
  foreignSymbol,
  intl,
}) => (
  <div className="statistics-bridge-data">
    <DataBlock
      description={intl.formatMessage({
        id: "components.i18n.BridgeStatistics.users",
      })}
      value={numeral(users).format("0,0")}
      type=""
    />
    <div className="separator" />
    <DataBlock
      description={intl.formatMessage(
        { id: "components.i18n.BridgeStatistics.totalBridged" },
        { tokenName: checkSymbol(foreignSymbol) }
      )}
      value={numeral(totalBridged).format("0,0.00 a", Math.floor)}
      type={checkSymbol(foreignSymbol)}
    />
    <div className="separator" />
    <DataBlock
      description={
        homeNativeSupplyTitle
          ? intl.formatMessage({
              id: "components.i18n.BridgeStatistics.nativeToken",
            })
          : intl.formatMessage({
              id: "components.i18n.BridgeStatistics.totalMinted",
            })
      }
      value={numeral(homeBalance).format("0.00 a", Math.floor)}
      type={homeSymbol}
    />
    <div className="separator" />
    <DataBlock
      description={`${checkSymbol(foreignSymbol)} ${intl.formatMessage({
        id: "components.i18n.BridgeStatistics.tokensAmount",
      })}`}
      value={numeral(foreignSupply).format("0,0.00 a", Math.floor)}
      type={checkSymbol(foreignSymbol)}
    />
  </div>
)

export default injectIntl(BridgeStatistics)
