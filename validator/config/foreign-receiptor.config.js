require('dotenv').config()
const baseConfig = require('./base.config')

const { web3Foreign } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.env,
  queue: 'foreign',
  id: 'foreign',
  name: 'receiptor-foreign',
  web3: web3Foreign,
  blockConfirmation: baseConfig.env.FOREIGN_BLOCK_CONFIRMATION,
  blockTime: baseConfig.env.FOREIGN_BLOCK_TIME
}
