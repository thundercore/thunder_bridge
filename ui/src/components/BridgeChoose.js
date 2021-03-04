import React from "react";
import { getTokenList } from "../stores/utils/getBridgeAddress";
import { RenameToken } from "./utils/renameToken";
import { bridgeType } from "../stores/utils/bridgeMode";

export const BridgeChoose = (props) => {
  const tokens = getTokenList();
  const chooseItems = [];

  const getPrefix = (token) => {
    if (token === "TT") {
      return bridgeType === "eth" ? "TT" : "Binance";
    }
    return "TT";
  };

  for (const token of tokens) {
    chooseItems.push({
      from: token,
      to: `${getPrefix(token)}-${token}`,
    });
    chooseItems.push({
      from: `${getPrefix(token)}-${token}`,
      to: token,
    });
  }

  const chooseLogoClass = (c) => {
    return "bridge-choose-logo logo-" + c.toLowerCase();
  };

  const renderAdditionalLogoInfo = (item) => {
    if (item === "Binance-TT") return <div className="logo-info">BEP 20</div>;
    return null;
  };

  const handleOptionChange = (mode) => {
    if (props.web3Store.metamaskNet.id === props.web3Store.foreignNet.id) {
      if (mode.from.substring(0, 3) === "TT-") {
        props.alert.pushError(
          `Please, change network to ${
            props.web3Store.homeNet.name
          } to transfer ${RenameToken(mode.from)}`
        );
      } else {
        props.alert.setLoading(true);
        props.setNewTokenHandler(mode.from);
      }
    } else {
      if (mode.from.substring(0, 3) !== "TT-") {
        props.alert.pushError(
          `Please, change network to ${
            props.web3Store.foreignNet.name
          } to transfer ${RenameToken(mode.from)}`
        );
      } else {
        props.alert.setLoading(true);
        props.setNewTokenHandler(mode.to);
      }
    }
  };

  const handleChecked = (item) => {
    if (props.isHome) {
      if (item.to === RenameToken(props.foreignStore.symbol)) {
        return true;
      }
    } else {
      if (item.from === RenameToken(props.foreignStore.symbol)) {
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
