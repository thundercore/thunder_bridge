import React from "react"
import { getTokenList } from "../stores/utils/getBridgeAddress"
import { RenameToken } from "./utils/renameToken"
import { bridgeType } from "../stores/utils/bridgeMode"
import { injectIntl } from "react-intl"

const BridgeChoose = ({
  setNewTokenHandler,
  web3Store,
  alert,
  isHome,
  foreignStore,
  intl,
  resetForm,
}) => {
  const tokens = getTokenList()
  const chooseItems = []

  const direction = {
    fromHome: 0,
    fromForeign: 1,
  }
  const ERC20 = "ERC20"
  const BEP20 = "BEP20"
  const HRC20 = "HRC20"

  const getPrefix = (token) => {
    if (token === "TT") {
      switch (bridgeType) {
        case "eth":
          return ERC20
        case "bsc":
          return BEP20
        case "heco":
          return HRC20
        default:
          return BEP20
      }
    }
    return "TT"
  }

  const getForeignToken = (token) => {
    console.log("getForeignToken bridgeType", bridgeType)
    if (token === "TT") return token
    switch (bridgeType) {
      case "eth":
        return `${ERC20}-${token}`
      case "bsc":
        return `${BEP20}-${token}`
      case "heco":
        return `${HRC20}-${token}`
      default:
        return `${BEP20}-${token}`
    }
  }

  const setItems = (token, type) => {
    if (type === 0) {
      chooseItems.push({
        from: getForeignToken(token),
        to: `${getPrefix(token)}-${token}`,
        direction: token === "TT" ? direction.fromHome : direction.fromForeign,
      })
    }
    if (type === 1) {
      chooseItems.push({
        from: `${getPrefix(token)}-${token}`,
        to: getForeignToken(token),
        direction: token === "TT" ? direction.fromForeign : direction.fromHome,
      })
    }
  }

  for (const token of tokens) {
    if (token === "TT") {
      setItems(token, 1)
      setItems(token, 0)
    } else {
      setItems(token, 0)
      setItems(token, 1)
    }
  }

  const chooseLogoClass = (c) => {
    return "bridge-choose-logo logo-" + c.toLowerCase()
  }

  const renderAdditionalLogoInfo = (item) => {
    if (item === "BEP20-TT") return <div className="logo-info">BEP20</div>
    if (item === "ERC20-TT") return <div className="logo-info">ERC20</div>
    if (item === "HRC20-TT") return <div className="logo-info">HRC20</div>
    return null
  }

  const handleOptionChange = (mode) => {
    resetForm()

    if (!isHome) {
      if (mode.direction === direction.fromHome) {
        alert.pushError(
          intl.formatMessage(
            { id: "components.i18n.BridgeChoose.changeNetworkTransfer" },
            {
              networkName: web3Store.homeNet.name,
              tokenName: RenameToken(filterNativeToken(mode.from)),
            }
          ),
          alert.WRONG_NETWORK_ERROR,
          web3Store.homeNet
        )
      } else {
        alert.setLoading(true)
        setNewTokenHandler(mode.to === "TT" ? "TT" : mode.from.split("-")[1])
      }
    } else {
      if (mode.direction === direction.fromForeign) {
        alert.pushError(
          intl.formatMessage(
            { id: "components.i18n.BridgeChoose.changeNetworkTransfer" },
            {
              networkName: web3Store.foreignNet.name,
              tokenName: RenameToken(filterNativeToken(mode.from)),
            }
          ),
          alert.WRONG_NETWORK_ERROR,
          web3Store.foreignNet
        )
      } else {
        alert.setLoading(true)
        setNewTokenHandler(mode.from === "TT" ? "TT" : mode.to.split("-")[1])
      }
    }
  }

  const verifyTokenMatch = (item, dir) => {
    console.log(item, dir, foreignStore.symbol)
    if (dir === direction.fromHome)
      return (
        item.to.split("-")[1] === RenameToken(foreignStore.symbol) ||
        (item.to.split("-")[1] === "BEP20-TT" && foreignStore.symbol === "TT")
      )
    return (
      item.from.split("-")[1] === RenameToken(foreignStore.symbol) ||
      (item.to.split("-")[1] === "ERC20-TT" && foreignStore.symbol === "TT")
    )
  }

  const handleChecked = (item) => {
    if (isHome) {
      if (
        item.direction === direction.fromHome &&
        verifyTokenMatch(item, direction.fromHome)
      ) {
        return true
      }
    } else {
      if (
        item.direction === direction.fromForeign &&
        verifyTokenMatch(item, direction.fromForeign)
      ) {
        return true
      }
    }
  }

  const filterNativeToken = (token) => {
    if (token === `${ERC20}-ETH`) return "ETH"
    if (token === `${BEP20}-BNB`) return "BNB"
    if (token === `${HRC20}-HT`) return "HT"
    return RenameToken(token)
  }

  return (
    <div className="bridge-choose">
      {chooseItems.map((item, index) => {
        return (
          <label key={index} className="bridge-choose-button">
            <input
              name="choose"
              type="radio"
              className="bridge-choose-radio"
              onChange={() => handleOptionChange(item)}
              checked={handleChecked(item)}
            />
            <span className="bridge-choose-container">
              <span className="bridge-choose-logo-container">
                <span
                  className={chooseLogoClass(filterNativeToken(item.from))}
                />
                {renderAdditionalLogoInfo(item.from)}
              </span>
              <span className="bridge-choose-text">
                {filterNativeToken(item.from)}
              </span>{" "}
              <i className="bridge-choose-arrow" />{" "}
              <span className="bridge-choose-text">
                {filterNativeToken(item.to)}
              </span>
              <span className="bridge-choose-logo-container">
                <span className={chooseLogoClass(filterNativeToken(item.to))} />
                {renderAdditionalLogoInfo(item.to)}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

export default injectIntl(BridgeChoose)
