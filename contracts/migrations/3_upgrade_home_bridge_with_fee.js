const { upgradeHomeBridgeWithFee } = require('../deploy/src/erc_to_erc/upgradeHomeBridgeWithFee')
const fs = require('fs')

module.exports = async function(deployer, network, accounts) {
  if (network === 'contract_test' || network === 'pala_single') {
    return
  }

  const deployed = require(process.cwd() + '/data/deployed.json')
  if (deployed.homeBridge.implemeation && Number(deployed.homeBridge.implemeation) >= 2) {
    return
  }

  return await upgradeHomeBridgeWithFee('2', deployed.homeBridge.address)
};
