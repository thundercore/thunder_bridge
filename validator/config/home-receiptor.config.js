require('dotenv').config()
const baseConfig = require('./base.config')

const { web3Home } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.env,
  queue: 'home',
  id: 'home',
  name: 'receiptor-home',
  web3: web3Home,
  blockConfirmation: baseConfig.env.HOME_BLOCK_CONFIRMATION,
  blockTime: baseConfig.env.HOME_BLOCK_TIME
}
