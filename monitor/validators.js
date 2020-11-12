
const Web3 = require('web3')
const fetch = require('node-fetch')
const { getBridgeABIs } = require('./utils/bridgeMode')
const { getValidatorList } = require('./utils/validatorUtils')
const { getBlockNumber } = require('./utils/contract')
const HttpRetryProvider = require('./utils/httpRetryProvider')
const logger = require('pino')()

function main ({
  HOME_RPC_URL,
  FOREIGN_RPC_URL,
  HOME_BRIDGE_ADDRESS,
  FOREIGN_BRIDGE_ADDRESS,
  GAS_PRICE_SPEED_TYPE,
  GAS_LIMIT,
  GAS_PRICE_FALLBACK,
  HOME_DEPLOYMENT_BLOCK,
  FOREIGN_DEPLOYMENT_BLOCK,
  HOME_MAX_GAS_PRICE_LIMIT,
  FOREIGN_MAX_GAS_PRICE_LIMIT,
}) {

  HOME_DEPLOYMENT_BLOCK = Number(HOME_DEPLOYMENT_BLOCK) || 0
  FOREIGN_DEPLOYMENT_BLOCK = Number(FOREIGN_DEPLOYMENT_BLOCK) || 0

  const Web3Utils = Web3.utils

  const homeProvider = new HttpRetryProvider(HOME_RPC_URL.split(","))
  const web3Home = new Web3(homeProvider)

  const foreignProvider = new HttpRetryProvider(FOREIGN_RPC_URL.split(","))
  const web3Foreign = new Web3(foreignProvider)

  const BRIDGE_VALIDATORS_ABI = require('./abis/BridgeValidators.abi')

  const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
  }

  async function getGasPrices(type, limit) {
    let gasPriceInGwei;
    try {
      const response = await fetch('https://gasprice.poa.network/')
      const json = await response.json()
      gasPriceInGwei = Math.min(Number(json[type]), Number(limit))
    } catch (e) {
      logger.error(e)
      gasPriceInGwei = GAS_PRICE_FALLBACK
    }
    const gasPrice = new Web3Utils.BN(Web3Utils.toWei(gasPriceInGwei.toString(10), 'gwei'))
    return [gasPriceInGwei, gasPrice]
  }



  return async function (bridgeMode) {
    try {
      const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs(bridgeMode)
      const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS)
      const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS)
      const homeValidatorsAddress = await homeBridge.methods.validatorContract().call()
      const homeBridgeValidators = new web3Home.eth.Contract(
        BRIDGE_VALIDATORS_ABI,
        homeValidatorsAddress
      )

      const [homeBlockNumber, foreignBlockNumber] = await getBlockNumber(web3Home, web3Foreign)

      const foreignValidatorsAddress = await foreignBridge.methods.validatorContract().call()
      const foreignBridgeValidators = new web3Foreign.eth.Contract(
        BRIDGE_VALIDATORS_ABI,
        foreignValidatorsAddress
      )

      const foreignValidators = await getValidatorList(
        foreignValidatorsAddress,
        web3Foreign.eth,
        FOREIGN_DEPLOYMENT_BLOCK,
        foreignBlockNumber
      )

      const homeValidators = await getValidatorList(
        homeValidatorsAddress,
        web3Home.eth,
        HOME_DEPLOYMENT_BLOCK,
        homeBlockNumber
      )

      const homeBalances = {}
      await asyncForEach(homeValidators, async v => {
        homeBalances[v] = Web3Utils.fromWei(await web3Home.eth.getBalance(v))
      })
      const foreignVBalances = {}
      const homeVBalances = {}
      const [homeGasPriceInGwei, homeGasPrice] = await getGasPrices(GAS_PRICE_SPEED_TYPE, HOME_MAX_GAS_PRICE_LIMIT)
      const [foreignGasPriceInGwei, foreignGasPrice] = await getGasPrices(GAS_PRICE_SPEED_TYPE, FOREIGN_MAX_GAS_PRICE_LIMIT)

      let validatorsMatch = true
      await asyncForEach(foreignValidators, async v => {
        const txCost = foreignGasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
        const balance = await web3Foreign.eth.getBalance(v)
        const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
        foreignVBalances[v] = {
          balance: Web3Utils.fromWei(balance),
          leftTx: Number(leftTx),
          gasPrice: foreignGasPriceInGwei
        }
        if (!homeValidators.includes(v)) {
          validatorsMatch = false
          foreignVBalances[v].onlyOnForeign = true
        }
      })
      await asyncForEach(homeValidators, async v => {
        const txCost = homeGasPrice.mul(new Web3Utils.BN(GAS_LIMIT))
        const balance = await web3Home.eth.getBalance(v)
        const leftTx = new Web3Utils.BN(balance).div(txCost).toString(10)
        homeVBalances[v] = {
          balance: Web3Utils.fromWei(balance),
          leftTx: Number(leftTx),
          gasPrice: homeGasPriceInGwei
        }
        if (!foreignValidators.includes(v)) {
          validatorsMatch = false
          homeVBalances[v].onlyOnHome = true
        }
      })
      const reqSigHome = await homeBridgeValidators.methods.requiredSignatures().call()
      const reqSigForeign = await foreignBridgeValidators.methods.requiredSignatures().call()
      return {
        home: {
          validators: {
            ...homeVBalances
          },
          requiredSignatures: Number(reqSigHome)
        },
        foreign: {
          validators: {
            ...foreignVBalances
          },
          requiredSignatures: Number(reqSigForeign)
        },
        requiredSignaturesMatch: reqSigHome === reqSigForeign,
        validatorsMatch,
        lastChecked: Math.floor(Date.now() / 1000)
      }
    } catch (e) {
      throw e
    }
  }
}
module.exports = main