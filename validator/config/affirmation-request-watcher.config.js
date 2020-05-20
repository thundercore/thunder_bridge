require('dotenv').config()
const baseConfig = require('./base.config')
const erc20Abi = require('../abis/ERC20.abi.json')

const id = `${baseConfig.id}-affirmation-request`

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.foreignConfig,
  ...baseConfig.env,
  event: 'Transfer',
  eventContractAddress: baseConfig.env.ERC20_TOKEN_ADDRESS,
  eventAbi: erc20Abi,
  eventFilter: { to: baseConfig.env.FOREIGN_BRIDGE_ADDRESS },
  queue: 'home',
  name: `watcher-${id}`,
  id
}
