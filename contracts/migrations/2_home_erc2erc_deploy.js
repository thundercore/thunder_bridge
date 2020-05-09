const deployErcToErc = require('../deploy/deployErc')
const env = require('../deploy/src/loadEnv')
const deployErc20 = require('../deploy/src/utils/deployERC20Token')
const ForeignBridge = artifacts.require("ForeignBridgeErcToErc");
const HomeBridge = artifacts.require("HomeBridgeErcToErc");
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken");

module.exports = function(deployer) {
  deployer.then(async () => {
    erc20TokenAddress = (await deployErc20()).erc677tokenAddress
    console.log("ERC20 TOKEN ADDRESS:", erc20TokenAddress)
    return await deployErcToErc(erc20TokenAddress);
  })


};
