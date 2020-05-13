require('dotenv').config({ path: __dirname + '/../.env' })
const path = require('path')
const fs = require('fs')

var deployedFile = path.join(__dirname, '../../data/deployed.json')
if (fs.existsSync(deployedFile)) {
  const deployed = require(deployedFile)
  process.env.HOME_BRIDGE_ADDRESS = deployed.homeBridge.address
  process.env.FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
  process.env.ERC20_TOKEN_ADDRESS = deployed.erc20Token.address
}

const baseConfig = require('./base.config')
const { web3Home } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  queue: 'home',
  id: 'home',
  name: 'sender-home',
  web3: web3Home
}