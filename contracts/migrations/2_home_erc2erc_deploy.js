const deployErcToErc = require('../deploy/deployErc')
const deployErc20 = require('../deploy/src/utils/deployERC20Token')
const fs = require('fs')

module.exports = async function(deployer, network, accounts) {
  if (network === 'contract_test') {
    return
  }
  if (network === 'pala_single' && fs.existsSync('data/deployed.json')) {
    return
  }

  erc20TokenAddress = (await deployErc20()).erc677tokenAddress
  return await deployErcToErc(erc20TokenAddress);
};
