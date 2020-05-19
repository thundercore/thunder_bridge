require('dotenv').config()
const baseConfig = require('./base.config')
const erc20Abi = require('../abis/ERC20.abi.json')

const id = `${baseConfig.id}-affirmation-request`

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.foreignConfig,
  event: 'Transfer',
  eventContractAddress: process.env.ERC20_TOKEN_ADDRESS,
  eventAbi: erc20Abi,
  eventFilter: { to: process.env.FOREIGN_BRIDGE_ADDRESS },
  queue_url: baseConfig.queueUrl,
  queue: 'home',
  name: `watcher-${id}`,
  id
}
