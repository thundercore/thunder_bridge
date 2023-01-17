/* eslint no-param-reassign: ["error", { "props": false }] */

const bridgeValidatorsAbi = require("../abis/BridgeValidators.abi");

const getValidatorList = async (address, web3) => {
  const validatorsContract = new web3.eth.Contract(
    bridgeValidatorsAbi,
    address
  );

  let validators = await validatorsContract.methods.validatorsList().call();
  validators = validators.map((v) => web3.utils.toChecksumAddress(v));

  return validators;
};

module.exports = {
  getValidatorList,
};
