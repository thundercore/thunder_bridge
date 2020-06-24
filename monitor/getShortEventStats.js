const Web3 = require('web3')
const { toBN } = require('web3').utils
const { getBridgeABIs, BRIDGE_MODES, ERC_TYPES } = require('./utils/bridgeMode')


const ERC20_ABI = require('./abis/ERC20.abi')
const { getTokenType } = require('./utils/ercUtils')
const { getPastEventsIter, getBlockNumber } = require('./utils/contract')

async function getPastEventsLength(iterator) {
  let length = 0
  for (const getPastEventPromise of iterator) {
    const events = await getPastEventPromise
    length += events.length
  }
  return length
}

function main({ HOME_RPC_URL, FOREIGN_RPC_URL, HOME_BRIDGE_ADDRESS, FOREIGN_BRIDGE_ADDRESS, HOME_DEPLOYMENT_BLOCK, FOREIGN_DEPLOYMENT_BLOCK }) {
  HOME_DEPLOYMENT_BLOCK = toBN(Number(HOME_DEPLOYMENT_BLOCK) || 0)
  FOREIGN_DEPLOYMENT_BLOCK = toBN(Number(FOREIGN_DEPLOYMENT_BLOCK) || 0)

  const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL)
  const web3Home = new Web3(homeProvider)

  const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL)
  const web3Foreign = new Web3(foreignProvider)
  return async function main(bridgeMode) {

    try {
      const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs(bridgeMode)
      const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS)
      const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS)
      const erc20MethodName = bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC ? 'erc677token' : 'erc20token'
      const erc20Address = await foreignBridge.methods[erc20MethodName]().call()
      const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, erc20Address)
      const tokenType = await getTokenType(foreignBridge, FOREIGN_BRIDGE_ADDRESS)

      const [homeBlockNumber, foreignBlockNumber] = await getBlockNumber(web3Home, web3Foreign)
      const homeDepositsIter = getPastEventsIter({
        contract: homeBridge,
        event: 'UserRequestForSignature',
        fromBlock: HOME_DEPLOYMENT_BLOCK,
        toBlock: homeBlockNumber,
        options: {}
      })
      const homeDepositsLength = await getPastEventsLength(homeDepositsIter)

      const foreignDepositsIter = getPastEventsIter({
        contract: foreignBridge,
        event: 'RelayedMessage',
        fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
        toBlock: foreignBlockNumber,
        options: {}
      })
      const foreignDepositsLength = await getPastEventsLength(foreignDepositsIter)

      const homeWithdrawalsIter = getPastEventsIter({
        contract: homeBridge,
        event: 'AffirmationCompleted',
        fromBlock: HOME_DEPLOYMENT_BLOCK,
        toBlock: homeBlockNumber,
        options: {}
      })
      const homeWithdrawalsLength = await getPastEventsLength(homeWithdrawalsIter)

      const foreignWithdrawalsIter =
        tokenType === ERC_TYPES.ERC20
          ? getPastEventsIter({
              contract: erc20Contract,
              event: 'Transfer',
              fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
              toBlock: foreignBlockNumber,
              options: {
                filter: { to: FOREIGN_BRIDGE_ADDRESS }
              }
            })
          : getPastEventsIter({
              contract: foreignBridge,
              event: 'UserRequestForAffirmation',
              fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
              toBlock: foreignBlockNumber,
              options: {}
            })
      const foreignWithdrawalsLength = await getPastEventsLength(foreignWithdrawalsIter)
      return {
        home: {
          deposits: homeDepositsLength,
          withdrawals: homeWithdrawalsLength,
        },
        foreign: {
          deposits: foreignDepositsLength,
          withdrawals: foreignWithdrawalsLength
        }
      }
    } catch (e) {
      throw e
    }
  }
}

module.exports = main