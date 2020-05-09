require('dotenv').config()

const privateKey = require('./private-keys.config')
const { toBN } = require('web3').utils
const { web3Home, web3Foreign } = require('../src/services/web3')
const { privateKeyToAddress } = require('../src/utils/utils')

const homeNativeErcAbi = require('../abis/HomeBridgeNativeToErc.abi')
const foreignNativeErcAbi = require('../abis/ForeignBridgeNativeToErc.abi')

const homeErcErcAbi = require('../abis/HomeBridgeErcToErc.abi')
const foreignErcErcAbi = require('../abis/ForeignBridgeErcToErc.abi')

const homeErcNativeAbi = require('../abis/HomeBridgeErcToNative.abi')
const foreignErcNativeAbi = require('../abis/ForeignBridgeErcToNative.abi')

let homeAbi
let foreignAbi
let id

console.log(process.env)

switch (process.env.BRIDGE_MODE) {
  case 'NATIVE_TO_ERC':
    homeAbi = homeNativeErcAbi
    foreignAbi = foreignNativeErcAbi
    id = 'native-erc'
    break
  case 'ERC_TO_ERC':
    homeAbi = homeErcErcAbi
    foreignAbi = foreignErcErcAbi
    id = 'erc-erc'
    break
  case 'ERC_TO_NATIVE':
    homeAbi = homeErcNativeAbi
    foreignAbi = foreignErcNativeAbi
    id = 'erc-native'
    break
  default:
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(`Bridge Mode: ${process.env.BRIDGE_MODE} not supported.`)
    } else {
      homeAbi = homeErcNativeAbi
      foreignAbi = foreignErcNativeAbi
      id = 'erc-native'
    }
}

let maxProcessingTime = null
if (String(process.env.MAX_PROCESSING_TIME) === '0') {
  maxProcessingTime = 0
} else if (!process.env.MAX_PROCESSING_TIME) {
  maxProcessingTime =
    4 * Math.max(process.env.HOME_POLLING_INTERVAL, process.env.FOREIGN_POLLING_INTERVAL)
} else {
  maxProcessingTime = Number(process.env.MAX_PROCESSING_TIME)
}

const bridgeConfig = {
  homeBridgeAddress: process.env.HOME_BRIDGE_ADDRESS,
  homeBridgeAbi: homeAbi,
  foreignBridgeAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  foreignBridgeAbi: foreignAbi,
  eventFilter: {},
  validatorAddress: null,
  maxProcessingTime
}

const homeConfig = {
  eventContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  eventAbi: homeAbi,
  bridgeContractAddress: process.env.HOME_BRIDGE_ADDRESS,
  bridgeAbi: homeAbi,
  pollingInterval: process.env.HOME_POLLING_INTERVAL,
  startBlock: toBN(process.env.HOME_START_BLOCK || 0),
  web3: web3Home
}

const foreignConfig = {
  eventContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  eventAbi: foreignAbi,
  bridgeContractAddress: process.env.FOREIGN_BRIDGE_ADDRESS,
  bridgeAbi: foreignAbi,
  pollingInterval: process.env.FOREIGN_POLLING_INTERVAL,
  startBlock: toBN(process.env.FOREIGN_START_BLOCK || 0),
  web3: web3Foreign
}

async function initialize() {
  const key = await privateKey.getValidatorKey()
  this.validatorAddress = privateKeyToAddress(key)
  console.log("DEBUG!!!", key, this.validatorAddress)
}

module.exports = {
  bridgeConfig,
  homeConfig,
  foreignConfig,
  id,
  initialize
}
