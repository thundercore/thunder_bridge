const envalid = require('envalid')
const { isAddress, toBN } = require('web3').utils
const { web3Home, web3Foreign } = require('../src/services/web3')

const homeNativeErcAbi = require('../abis/HomeBridgeNativeToErc.abi.json')
const foreignNativeErcAbi = require('../abis/ForeignBridgeNativeToErc.abi.json')

const homeErcErcAbi = require('../abis/HomeBridgeErcToErc.abi.json')
const foreignErcErcAbi = require('../abis/ForeignBridgeErcToErc.abi.json')

const homeErcNativeAbi = require('../abis/HomeBridgeErcToNative.abi.json')
const foreignErcNativeAbi = require('../abis/ForeignBridgeErcToNative.abi.json')

let homeAbi
let foreignAbi
let id


const validateAddress = envalid.makeValidator(address => {
  if (isAddress(address)) {
    return address
  }
  throw new Error(`Invalid address: ${address}`)
})

const bigNumValidator = envalid.makeValidator(x => x? toBN(x): toBN(0))

let validations = {
  BRIDGE_MODE: envalid.str({choices: ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']}),
  NODE_ENV: envalid.str({default: 'test'}),
  LOG_LEVEL: envalid.str({default: 'debug'}),
  MAX_PROCESSING_TIME: envalid.num({default: null}),
  FOREIGN_BRIDGE_ADDRESS: validateAddress(),
  HOME_BRIDGE_ADDRESS: validateAddress(),
  HOME_POLLING_INTERVAL: envalid.num({default: 2000}),
  ERC20_TOKEN_ADDRESS: validateAddress(),
  HOME_START_BLOCK: bigNumValidator(),
  FOREIGN_POLLING_INTERVAL: envalid.num({default: 2000}),
  FOREIGN_START_BLOCK: bigNumValidator(),
  QUEUE_URL: envalid.str(),
  REDIS_LOCK_TTL: envalid.num(),
  ALLOW_HTTP: envalid.str({default: 'no'}),
  HOME_BLOCK_CONFIRMATION: envalid.num({default: 6}),
  FOREIGN_BLOCK_CONFIRMATION: envalid.num( {default: 6}),
  MAX_WAIT_RECEIPT_BLOCK: envalid.num(),
  GET_RECEIPT_TIMEOUT: envalid.num(),
  QUEUE_RETRY_DELAY: envalid.num({default: 2000}),
  QUEUE_RETRY_LIMIT: envalid.num({default: 5}),
  EXTRA_GAS_PERCENTAGE: envalid.num({default: 1}),
  HOME_VALIDATOR_REQUIRED_BALANCE: envalid.num({ default: 0.1 }),
  FOREIGN_VALIDATOR_REQUIRED_BALANCE: envalid.num({ default: 0.1 }),
  HOME_BLOCK_TIME: envalid.num({ default: 1000 }),
  FOREIGN_BLOCK_TIME: envalid.num({ default: 1000 }),
}

const env = envalid.cleanEnv(process.env, validations, {})

switch (env.BRIDGE_MODE) {
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
if (String(env.MAX_PROCESSING_TIME) === '0') {
  maxProcessingTime = 0
} else if (!env.MAX_PROCESSING_TIME) {
  maxProcessingTime =
    4 * Math.max(env.HOME_POLLING_INTERVAL, env.FOREIGN_POLLING_INTERVAL)
} else {
  maxProcessingTime = Number(env.MAX_PROCESSING_TIME)
}

const bridgeConfig = {
  homeBridgeAddress: env.HOME_BRIDGE_ADDRESS,
  homeBridgeAbi: homeAbi,
  foreignBridgeAddress: env.FOREIGN_BRIDGE_ADDRESS,
  foreignBridgeAbi: foreignAbi,
  eventFilter: {},
  maxProcessingTime
}

const homeConfig = {
  eventContractAddress: env.HOME_BRIDGE_ADDRESS,
  eventAbi: homeAbi,
  bridgeContractAddress: env.HOME_BRIDGE_ADDRESS,
  bridgeAbi: homeAbi,
  pollingInterval: env.HOME_POLLING_INTERVAL,
  startBlock: env.HOME_START_BLOCK,
  web3: web3Home
}

const foreignConfig = {
  eventContractAddress: env.FOREIGN_BRIDGE_ADDRESS,
  eventAbi: foreignAbi,
  bridgeContractAddress: env.FOREIGN_BRIDGE_ADDRESS,
  bridgeAbi: foreignAbi,
  pollingInterval: env.FOREIGN_POLLING_INTERVAL,
  startBlock: env.FOREIGN_START_BLOCK,
  web3: web3Foreign
}

module.exports = {
  bridgeConfig,
  homeConfig,
  foreignConfig,
  id,
  env
}
