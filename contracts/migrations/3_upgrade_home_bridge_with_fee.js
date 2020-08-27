const { upgradeHomeBridgeWithFee } = require('../deploy/src/erc_to_erc/upgradeHomeBridgeWithFee')
const deployErc20 = require('../deploy/src/utils/deployERC20Token')
const fs = require('fs')

module.exports = function(deployer, network) {
  if (network === 'contract_test' || network === 'pala_single') {
    return
  }

  const deployed = require(process.cwd() + '/data/deployed.json')
  deployer.then(async () => {
    await upgradeHomeBridgeWithFee(deployed.homeBridge.address)
  })
};
