const deployErcToErc = require('../deploy/deployErc')
const deployErc20 = require('../deploy/src/utils/deployERC20Token')

module.exports = function(deployer) {
  deployer.then(async () => {
    erc20TokenAddress = (await deployErc20()).erc677tokenAddress
    return await deployErcToErc(erc20TokenAddress);
  })
};