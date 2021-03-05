const Web3 = require('web3')
const { toBN } = require('web3').utils
const { getBridgeABIs, ERC_TYPES } = require('./bridgeMode')
const { getTokenType } = require('./ercUtils')
const HttpRetryProvider = require('./httpRetryProvider')


function main({ HOME_RPC_URL, FOREIGN_RPC_URL, HOME_BRIDGE_ADDRESS, FOREIGN_BRIDGE_ADDRESS, HOME_DEPLOYMENT_BLOCK, FOREIGN_DEPLOYMENT_BLOCK }){
  return async function() {
    HOME_DEPLOYMENT_BLOCK = toBN(Number(HOME_DEPLOYMENT_BLOCK) || 0)
    FOREIGN_DEPLOYMENT_BLOCK = toBN(Number(FOREIGN_DEPLOYMENT_BLOCK) || 0)
    const homeProvider = new HttpRetryProvider(HOME_RPC_URL.split(","))
    const web3Home = new Web3(homeProvider)

    const foreignProvider = new HttpRetryProvider(FOREIGN_RPC_URL.split(","))
    const web3Foreign = new Web3(foreignProvider)

    const HOME_ERC_TO_ERC_ABI = require('../abis/HomeBridgeErcToErc.abi')
    const ERC20_ABI = require('../abis/ERC20.abi')
    const { getPastEvents, getBlockNumber } = require('./contract')

    try {
      const homeErcBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, HOME_BRIDGE_ADDRESS)
      const bridgeModeHash = await homeErcBridge.methods.getBridgeMode().call()
      const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs()
      const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS)
      const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS)
      const tokenType = await getTokenType(foreignBridge, FOREIGN_BRIDGE_ADDRESS)
      const isExternalErc20 = tokenType === ERC_TYPES.ERC20
      const erc20MethodName = 'erc20token'
      const erc20Address = await foreignBridge.methods[erc20MethodName]().call()
      const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, erc20Address)

      const [homeBlockNumber, foreignBlockNumber] = await getBlockNumber(web3Home, web3Foreign)


      const homeDeposits = await getPastEvents({
        contract: homeBridge,
        event: 'UserRequestForSignature',
        fromBlock: HOME_DEPLOYMENT_BLOCK,
        toBlock: homeBlockNumber,
        options: {}
      })

      const foreignDeposits = await getPastEvents({
        contract: foreignBridge,
        event: 'RelayedMessage',
        fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
        toBlock: foreignBlockNumber,
        options: {}
      })

      const homeWithdrawals = await getPastEvents({
        contract: homeBridge,
        event: 'AffirmationCompleted',
        fromBlock: HOME_DEPLOYMENT_BLOCK,
        toBlock: homeBlockNumber,
        options: {}
      })

      const foreignWithdrawals = isExternalErc20
        ? await getPastEvents({
            contract: erc20Contract,
            event: 'Transfer',
            fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
            toBlock: foreignBlockNumber,
            options: {
              filter: { to: FOREIGN_BRIDGE_ADDRESS }
            }
          })
        : await getPastEvents({
            contract: foreignBridge,
            event: 'UserRequestForAffirmation',
            fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
            toBlock: foreignBlockNumber,
            options: {}
          })
      return {
        homeDeposits,
        foreignDeposits,
        homeWithdrawals,
        foreignWithdrawals,
        isExternalErc20
      }
    } catch (e) {
      throw e
    }
  }
}

module.exports = main
