require('dotenv').config()
const fetch = require('node-fetch')
const Web3Utils = require('web3-utils')
const BN = require('bn.js')
const { web3Home, web3Foreign } = require('./web3')
const { bridgeConfig } = require('../../config/base.config')
const config = require('../../config')
const logger = require('./logger').child({
  module: 'gasPrice',
})
const { setIntervalAndRun } = require('../utils/utils')
const { DEFAULT_UPDATE_INTERVAL, GAS_PRICE_BOUNDARIES } = require('../utils/constants')

const HomeABI = bridgeConfig.homeBridgeAbi
const ForeignABI = bridgeConfig.foreignBridgeAbi

const {
  FOREIGN_BRIDGE_ADDRESS,
  FOREIGN_GAS_PRICE_FALLBACK,
  FOREIGN_GAS_PRICE_ORACLE_URL,
  FOREIGN_GAS_PRICE_UPDATE_INTERVAL,
  HOME_BRIDGE_ADDRESS,
  HOME_GAS_PRICE_FALLBACK,
  HOME_GAS_PRICE_ORACLE_URL,
  HOME_GAS_PRICE_UPDATE_INTERVAL,
} = process.env

const homeBridge = new web3Home.eth.Contract(HomeABI, HOME_BRIDGE_ADDRESS)

const foreignBridge = new web3Foreign.eth.Contract(ForeignABI, FOREIGN_BRIDGE_ADDRESS)

let cachedGasPrice = {
  standard: '0',
  fast: '0',
  instant: '0',
}

function gasPriceWithinLimits(gasPrice) {
  if (gasPrice < GAS_PRICE_BOUNDARIES.MIN) {
    return GAS_PRICE_BOUNDARIES.MIN
  }
  if (gasPrice > config.maxGasPriceLimit) {
    return config.maxGasPriceLimit
  }
  return gasPrice
}

async function fetchGasPriceFromOracle(oracleUrl) {
  const response = await fetch(oracleUrl)
  const json = await response.json()
  const oracleGasPrice = {
    standard: '0',
    fast: '0',
    instant: '0',
  }
  const speedTypes = ['standard', 'fast', 'instant']
  for (let i = 0; i < speedTypes.length; i++) {
    const speedType = speedTypes[i]
    const price = json[speedType]
    if (!price) {
      throw new Error(`Response from Oracle didn't include gas price for ${speedType} type.`)
    }
    const gasPrice = gasPriceWithinLimits(price)
    oracleGasPrice[speedType] = Web3Utils.toWei(gasPrice.toString(), 'gwei')
  }
  return oracleGasPrice
}

async function fetchGasPrice({ bridgeContract, oracleFn }) {
  let gasPriceFromOracle = null
  try {
    gasPriceFromOracle = await oracleFn()
    logger.debug({ gasPriceFromOracle }, 'Gas price updated using the oracle')
  } catch (e) {
    logger.error(`Gas Price API is not available. ${e.message}`)
  }

  let gasPriceFromBridgeContract = null
  try {
    const p = await bridgeContract.methods.gasPrice().call()
    gasPriceFromBridgeContract = {
      standard: p,
      fast: p,
      instant: p,
    }
    logger.debug({ gasPriceFromBridgeContract }, 'Gas price updated using the contracts')
  } catch (e) {
    logger.error(`There was a problem getting the gas price from the contract. ${e.message}`)
  }

  if (!gasPriceFromOracle) {
    return gasPriceFromBridgeContract
  }

  if (!gasPriceFromBridgeContract) {
    return gasPriceFromOracle
  }

  return {
    standard: BN.max(
      Web3Utils.toBN(gasPriceFromOracle.standard),
      Web3Utils.toBN(gasPriceFromBridgeContract.standard),
    ).toString(),
    fast: BN.max(Web3Utils.toBN(gasPriceFromOracle.fast), Web3Utils.toBN(gasPriceFromBridgeContract.fast)).toString(),
    instant: BN.max(
      Web3Utils.toBN(gasPriceFromOracle.instant),
      Web3Utils.toBN(gasPriceFromBridgeContract.instant),
    ).toString(),
  }
}

let fetchGasPriceInterval = null

async function start(chainId) {
  clearInterval(fetchGasPriceInterval)

  let bridgeContract = null
  let oracleUrl = null
  let updateInterval = null
  if (chainId === 'home') {
    bridgeContract = homeBridge
    oracleUrl = HOME_GAS_PRICE_ORACLE_URL
    updateInterval = HOME_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL

    cachedGasPrice.standard = HOME_GAS_PRICE_FALLBACK
    cachedGasPrice.fast = HOME_GAS_PRICE_FALLBACK
    cachedGasPrice.instant = HOME_GAS_PRICE_FALLBACK
  } else if (chainId === 'foreign') {
    bridgeContract = foreignBridge
    oracleUrl = FOREIGN_GAS_PRICE_ORACLE_URL
    updateInterval = FOREIGN_GAS_PRICE_UPDATE_INTERVAL || DEFAULT_UPDATE_INTERVAL

    cachedGasPrice.standard = FOREIGN_GAS_PRICE_FALLBACK
    cachedGasPrice.fast = FOREIGN_GAS_PRICE_FALLBACK
    cachedGasPrice.instant = FOREIGN_GAS_PRICE_FALLBACK
  } else {
    throw new Error(`Unrecognized chainId '${chainId}'`)
  }

  fetchGasPriceInterval = setIntervalAndRun(async () => {
    const gasPrice = await fetchGasPrice({
      bridgeContract,
      oracleFn: () => fetchGasPriceFromOracle(oracleUrl),
    })
    cachedGasPrice = gasPrice || cachedGasPrice
  }, updateInterval)
}

function getSpeedBase() {
  switch (config.speedType) {
    case "standard":
      return 0
    case "fast":
      return 1
    case "instant":
      return 2
    default:
      return 0
  }
}

function getPrice(timestamp) {
  if (process.env.SET_GAS_PRICE) {
    return process.env.SET_GAS_PRICE.toString()
  }

  let gasPrice = '0'
  const dt = Date.now() - timestamp
  const base = getSpeedBase()
  const speed = base + Math.floor(dt / process.env.GAS_PRICE_BUMP_INTERVAL)

  if (speed == 0) {
    gasPrice = cachedGasPrice.standard
  } else if (speed == 1) {
    gasPrice = cachedGasPrice.fast
  } else if (speed >= 2) {
    // diff = (instant-fast) > 0 ? (instant-fast) : 10
    let diff = Web3Utils.toBN(cachedGasPrice.instant).sub(Web3Utils.toBN(cachedGasPrice.fast))
    if (diff.lte(Web3Utils.toBN(0))) {
      diff = Web3Utils.toBN(Web3Utils.toWei('10', 'gwei'))
    }
    logger.debug({speed, diff: diff.toString()}, `bump gas price`)
    // gasPrice = instant + diff * (speed-2)
    gasPrice = Web3Utils.toBN(cachedGasPrice.instant).add(diff.mul(Web3Utils.toBN(speed - 2)))
    gasPrice = BN.min(
      Web3Utils.toBN(Web3Utils.toWei(config.maxGasPriceLimit.toString(), 'gwei')),
      gasPrice
    ).toString()
  }

  return gasPrice
}

// this function is only for unit test
function setTestCachedGasPrice(price) {
  if (process.env.GET_PRICE_TEST === 'test') {
    cachedGasPrice = price
  }
}

module.exports = {
  start,
  fetchGasPrice,
  getPrice,
  gasPriceWithinLimits,
  setTestCachedGasPrice,
}
