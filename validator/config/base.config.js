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
  ALLOW_HTTP: envalid.str({default: 'no'}),
  BRIDGE_MODE: envalid.str({choices: ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']}),
  ERC20_TOKEN_ADDRESS: validateAddress(),
  EXTRA_GAS_PERCENTAGE: envalid.num({default: 1}),
  FOREIGN_BLOCK_CONFIRMATION: envalid.num( {default: 6}),
  FOREIGN_BLOCK_TIME: envalid.num({ default: 1000 }),
  FOREIGN_BRIDGE_ADDRESS: validateAddress(),
  FOREIGN_POLLING_INTERVAL: envalid.num({default: 2000}),
  FOREIGN_START_BLOCK: bigNumValidator(),
  FOREIGN_VALIDATOR_REQUIRED_BALANCE: envalid.num({ default: 0.1 }),
  FOREIGN_GAS_PRICE_SPEED_TYPE: envalid.str({ default: 'standard' }),
  GAS_PRICE_BUMP_INTERVAL: envalid.num({ default: 60 * 1000 }),
  HOME_BLOCK_CONFIRMATION: envalid.num({default: 6}),
  HOME_BLOCK_TIME: envalid.num({ default: 1000 }),
  HOME_BRIDGE_ADDRESS: validateAddress(),
  HOME_POLLING_INTERVAL: envalid.num({default: 2000}),
  HOME_START_BLOCK: bigNumValidator(),
  HOME_VALIDATOR_REQUIRED_BALANCE: envalid.num({ default: 0.1 }),
  HOME_GAS_PRICE_SPEED_TYPE: envalid.str({ default: 'standard' }),
  LOG_LEVEL: envalid.str({default: 'debug'}),
  MAX_PROCESSING_TIME: envalid.num({default: null}),
  MAX_WAIT_RECEIPT_BLOCK: envalid.num(),
  MAX_GAS_PRICE_LIMIT: envalid.num({default: 250}),
  NODE_ENV: envalid.str({default: 'test'}),
  QUEUE_RETRY_DELAY: envalid.num({default: 2000}),
  QUEUE_RETRY_LIMIT: envalid.num({default: 5}),
  QUEUE_URL: envalid.str(),
  REDIS_LOCK_TTL: envalid.num(),
}

const env = envalid.cleanEnv(process.env, validations, {})
process.env = Object.assign({}, process.env, env)

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
