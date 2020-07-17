require('dotenv').config()
const baseConfig = require('./base.config')

const { web3Foreign } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.env,
  queue: 'foreign',
  id: 'foreign',
  name: 'sender-foreign',
  web3: web3Foreign,
  validatorRequiredBalance: baseConfig.env.FOREIGN_VALIDATOR_REQUIRED_BALANCE,
  speedType: baseConfig.env.FOREIGN_GAS_PRICE_SPEED_TYPE,
  maxGasPriceLimit: baseConfig.env.FOREIGN_MAX_GAS_PRICE_LIMIT,
}