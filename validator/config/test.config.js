require('dotenv').config({ path: __dirname + '/../.env' })
const path = require('path')
const fs = require('fs')

const baseConfig = require('./base.config')
const { web3Home } = require('../src/services/web3')

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.env,
  queue: 'home',
  id: 'home',
  name: 'sender-home',
  web3: web3Home
}