const Web3 = require('web3')
const { toBN } = require('web3').utils
const { getBridgeABIs, BRIDGE_MODES, ERC_TYPES } = require('./utils/bridgeMode')


const ERC20_ABI = require('./abis/ERC20.abi')
const { getTokenType } = require('./utils/ercUtils')
const { getPastEventsIter, getBlockNumber } = require('./utils/contract')
const HttpRetryProvider = require('./utils/httpRetryProvider')

async function processEvents(iterator, lastLength, lastValue) {
  for (const getPastEventPromise of iterator) {
    const events = await getPastEventPromise
    lastLength += events.length
    for (const event of events) {
      lastValue = lastValue.add(toBN(event.returnValues.value))
    }
  }
  return [lastLength, lastValue]
}

function main({ HOME_RPC_URL, FOREIGN_RPC_URL, HOME_BRIDGE_ADDRESS, FOREIGN_BRIDGE_ADDRESS, HOME_DEPLOYMENT_BLOCK, FOREIGN_DEPLOYMENT_BLOCK, redis, token }) {
  HOME_DEPLOYMENT_BLOCK = toBN(Number(HOME_DEPLOYMENT_BLOCK) || 0)
  FOREIGN_DEPLOYMENT_BLOCK = toBN(Number(FOREIGN_DEPLOYMENT_BLOCK) || 0)

  const homeProvider = new HttpRetryProvider(HOME_RPC_URL.split(","))
  const web3Home = new Web3(homeProvider)

  const foreignProvider = new HttpRetryProvider(FOREIGN_RPC_URL.split(","))
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
      let homeDepositsCachedLength = 0;
      let homeWithdrawalsCachedLength = 0;
      let foreignDepositsCachedLength = 0;
      let foreignWithdrawalsCachedLength = 0;
      let homeDepositCachedValue = toBN(0)
      let homeWithdrawalCachedValue = toBN(0)
      let foreignDepositCachedValue = toBN(0)
      let foreignWithdrawalCachedValue = toBN(0)
      let homeStartBlock = HOME_DEPLOYMENT_BLOCK
      let foreignStartBlock = FOREIGN_DEPLOYMENT_BLOCK

      if (redis) {
        lengthObj = await redis.getProcessedResult(token)
        if (lengthObj) {
          homeDepositsCachedLength = Number(lengthObj.home.deposits)
          homeWithdrawalsCachedLength = Number(lengthObj.home.withdrawals)
          foreignDepositsCachedLength = Number(lengthObj.foreign.deposits)
          foreignWithdrawalsCachedLength = Number(lengthObj.foreign.withdrawals)
          homeDepositCachedValue = toBN(lengthObj.home.depositValue)
          homeWithdrawalCachedValue = toBN(lengthObj.home.withdrawalValue)
          foreignDepositCachedValue = toBN(lengthObj.foreign.depositValue)
          foreignWithdrawalCachedValue = toBN(lengthObj.foreign.withdrawalValue)
        }
        [homeLastProcessedBlock, foreignLastProcessedBlock] = await redis.getProcessedBlock(token)
        homeStartBlock = homeLastProcessedBlock === null?
          HOME_DEPLOYMENT_BLOCK : toBN(Number(homeLastProcessedBlock)+1)
        foreignStartBlock = foreignLastProcessedBlock === null?
          FOREIGN_DEPLOYMENT_BLOCK : toBN(Number(foreignLastProcessedBlock)+1)
      }

      const [homeBlockNumber, foreignBlockNumber] = await getBlockNumber(web3Home, web3Foreign)

      const homeDepositsIter = getPastEventsIter({
        contract: homeBridge,
        event: 'UserRequestForSignature',
        fromBlock: homeStartBlock,
        toBlock: homeBlockNumber,
        options: {},
        token
      })
      const [homeDepositsLength, homeDepositValue] = await processEvents(homeDepositsIter, homeDepositsCachedLength, homeDepositCachedValue)

      const foreignDepositsIter = getPastEventsIter({
        contract: foreignBridge,
        event: 'RelayedMessage',
        fromBlock: foreignStartBlock,
        toBlock: foreignBlockNumber,
        options: {},
        token
      })
      const [foreignDepositsLength, foreignDepositValue] = await processEvents(foreignDepositsIter, foreignDepositsCachedLength, foreignDepositCachedValue)

      const homeWithdrawalsIter = getPastEventsIter({
        contract: homeBridge,
        event: 'AffirmationCompleted',
        fromBlock: homeStartBlock,
        toBlock: homeBlockNumber,
        options: {},
        token
      })
      const [homeWithdrawalsLength, homeWithdrawalValue] = await processEvents(homeWithdrawalsIter, homeWithdrawalsCachedLength, homeWithdrawalCachedValue)

      const foreignWithdrawalsIter =
        tokenType === ERC_TYPES.ERC20
          ? getPastEventsIter({
              contract: erc20Contract,
              event: 'Transfer',
              fromBlock: foreignStartBlock,
              toBlock: foreignBlockNumber,
              options: {
                filter: { to: FOREIGN_BRIDGE_ADDRESS }
              },
              token
            })
          : getPastEventsIter({
              contract: foreignBridge,
              event: 'UserRequestForAffirmation',
              fromBlock: foreignStartBlock,
              toBlock: foreignBlockNumber,
              options: {},
              token
            })

      const [foreignWithdrawalsLength, foreignWithdrawalValue] = await processEvents(foreignWithdrawalsIter, foreignWithdrawalsCachedLength, foreignWithdrawalCachedValue)
      lengthObj = {
        home: {
          deposits: homeDepositsLength,
          depositValue: homeDepositValue.toString(),
          withdrawals: homeWithdrawalsLength,
          withdrawalValue: homeWithdrawalValue.toString(),
        },
        foreign: {
          deposits: foreignDepositsLength,
          depositValue: foreignDepositValue.toString(),
          withdrawals: foreignWithdrawalsLength,
          withdrawalValue: foreignWithdrawalValue.toString(),
        }
      }

      if(redis) {
        await redis.storeProcessedResult(token, lengthObj, homeBlockNumber, foreignBlockNumber)
      }

      return lengthObj
    } catch (e) {
      throw e
    }
  }
}

module.exports = main