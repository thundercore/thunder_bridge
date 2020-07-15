require('dotenv').config()
const baseConfig = require('./base.config')

const { web3Home } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.env,
  queue: 'home',
  id: 'home',
  name: 'sender-home',
  web3: web3Home,
  validatorRequiredBalance: baseConfig.env.HOME_VALIDATOR_REQUIRED_BALANCE,
  speedType: baseConfig.env.HOME_GAS_PRICE_SPEED_TYPE,
}
