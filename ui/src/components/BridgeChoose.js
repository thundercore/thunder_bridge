import React from "react";
import { getTokenList } from "../stores/utils/getBridgeAddress";
import { RenameToken } from "./utils/renameToken";
import { bridgeType } from "../stores/utils/bridgeMode";

export const BridgeChoose = (props) => {
  const tokens = getTokenList();
  const chooseItems = [];

  const direction = {
    fromHome: 0,
    fromForeign: 1
  }

  const getPrefix = (token) => {
    if (token === "TT") {
      return bridgeType === "eth" ? "TT" : "BSC";
    }
    return "TT";
  };

  const setItems = (token, type) => {
    if (type === 0) {
      chooseItems.push({
        from: token,
        to: `${getPrefix(token)}-${token}`,
        direction: token === "TT" ? direction.fromHome : direction.fromForeign
      })
    }
    if (type === 1) {
      chooseItems.push({
        from: `${getPrefix(token)}-${token}`,
        to: token,
        direction: token === "TT" ? direction.fromForeign : direction.fromHome
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
    return "bridge-choose-logo logo-" + c.toLowerCase();
  };

  const renderAdditionalLogoInfo = (item) => {
    if (item === "BSC-TT") return <div className="logo-info">BEP 20</div>;
    return null;
  };

  const handleOptionChange = (mode) => {
    if (!props.isHome) {
      if (mode.direction === direction.fromHome) {
        props.alert.pushError(
          `Please, change network to ${
            props.web3Store.homeNet.name
          } to transfer ${RenameToken(mode.from)}`,
          props.alert.WRONG_NETWORK_ERROR
        );
      } else {
        props.alert.setLoading(true);
        props.setNewTokenHandler(mode.to === "TT" ? "TT" : mode.from);
      }
    } else {
      if (mode.direction === direction.fromForeign) {
        props.alert.pushError(
          `Please, change network to ${
            props.web3Store.foreignNet.name
          } to transfer ${RenameToken(mode.from)}`,
          props.alert.WRONG_NETWORK_ERROR
        );
      } else {
        props.alert.setLoading(true);
        props.setNewTokenHandler(mode.from === "TT" ? "TT" : mode.to);
      }
    }
  };

  const verifyTokenMatch = (item, dir) => {
    if (dir === direction.fromHome) return item.to === RenameToken(props.foreignStore.symbol) || item.to === "BSC-TT" && props.foreignStore.symbol === "TT"
    return item.from === RenameToken(props.foreignStore.symbol) || item.to === "TT" && props.foreignStore.symbol === "TT"
  }

  const handleChecked = (item) => {
    if (props.isHome) {
      if (item.direction === direction.fromHome && verifyTokenMatch(item, direction.fromHome)) {
        return true;
      }
    } else {
      if (item.direction === direction.fromForeign && verifyTokenMatch(item, direction.fromForeign)) {
        return true;
      }
    }
  };

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
                <span className={chooseLogoClass(item.from)} />
                {renderAdditionalLogoInfo(item.from)}
              </span>
              <span className="bridge-choose-text">
                {RenameToken(item.from)} <i className="bridge-choose-arrow" />{" "}
                {RenameToken(item.to)}
              </span>
              <span className="bridge-choose-logo-container">
                <span className={chooseLogoClass(item.to)} />
                {renderAdditionalLogoInfo(item.to)}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
};
