const deployErcToErc = require('../deploy/deployErc')
const deployErc20 = require('../deploy/src/utils/deployERC20Token')
const ForeignBridge = artifacts.require("ForeignBridgeErcToErc");
const HomeBridge = artifacts.require("HomeBridgeErcToErc");

module.exports = function(deployer) {
  deployer.then(async () => {
    erc20TokenAddress = (await deployErc20()).erc677tokenAddress
    return await deployErcToErc(erc20TokenAddress);
  })

  deployer.deploy(ForeignBridge)
  deployer.deploy(HomeBridge)
};
