const Web3 = require('web3')
const { toBN } = require('web3').utils
const { getBridgeABIs, BRIDGE_MODES, ERC_TYPES } = require('./utils/bridgeMode')


const ERC20_ABI = require('./abis/ERC20.abi')
const { getTokenType } = require('./utils/ercUtils')
const { getPastEventsIter, getBlockNumber } = require('./utils/contract')
const HttpRetryProvider = require('./utils/httpRetryProvider')

async function processEvents(iterator, processedResult) {
  for (const getPastEventPromise of iterator) {
    const events = await getPastEventPromise
    processedResult.length += events.length
    for (const event of events) {
      processedResult.value = processedResult.value.add(toBN(event.returnValues.value))
      if (event.returnValues.recipient) {
        processedResult.users.add(event.returnValues.recipient)
      }
    }
  }
  return processedResult
}

function initCacheObject(cachedObj=null){
  if (cachedObj === null) {
    return {
      value: toBN(0),
      length: 0,
      users: new Set()
    }
  }
  const users = cachedObj.users? cachedObj.users: []
  return {
    value: toBN(cachedObj.value),
    length: cachedObj.length,
    users: new Set(users)
  }
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

      let homeDepositCache = initCacheObject()
      let homeWithdrawalCache = initCacheObject()
      let foreignDepositCache = initCacheObject()
      let foreignWithdrawalCache = initCacheObject()

      let homeStartBlock = HOME_DEPLOYMENT_BLOCK
      let foreignStartBlock = FOREIGN_DEPLOYMENT_BLOCK

      if (redis) {
        homeDepositCache = initCacheObject(await redis.getProcessedResult(token, 'homeDeposit'))
        homeWithdrawalCache= initCacheObject(await redis.getProcessedResult(token, 'homeWithdrawal'))
        foreignDepositCache = initCacheObject(await redis.getProcessedResult(token, 'foreignDeposit'))
        foreignWithdrawalCache = initCacheObject(await redis.getProcessedResult(token, 'foreignWithdrawal'))

        const [homeLastProcessedBlock, foreignLastProcessedBlock] = await redis.getProcessedBlock(token)
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
      const homeDeposit = await processEvents(homeDepositsIter, homeDepositCache)

      const foreignDepositsIter = getPastEventsIter({
        contract: foreignBridge,
        event: 'RelayedMessage',
        fromBlock: foreignStartBlock,
        toBlock: foreignBlockNumber,
        options: {},
        token
      })
      const foreignDeposit = await processEvents(foreignDepositsIter, foreignDepositCache)

      const homeWithdrawalsIter = getPastEventsIter({
        contract: homeBridge,
        event: 'AffirmationCompleted',
        fromBlock: homeStartBlock,
        toBlock: homeBlockNumber,
        options: {},
        token
      })
      const homeWithdrawal = await processEvents(homeWithdrawalsIter, homeWithdrawalCache)

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

      const foreignWithdrawal = await processEvents(foreignWithdrawalsIter, foreignWithdrawalCache)

      if(redis) {
        await Promise.all([
          redis.storeProcessedResult(token, 'homeDeposit', homeDeposit),
          redis.storeProcessedResult(token, 'homeWithdrawal', homeWithdrawal),
          redis.storeProcessedResult(token, 'foreignDeposit', foreignDeposit),
          redis.storeProcessedResult(token, 'foreignWithdrawal', foreignWithdrawal),
          redis.storeProcessedBlock(token, homeBlockNumber, foreignBlockNumber),
        ])
      }

      return {
        home: {
          deposits: homeDeposit.length,
          depositValue: homeDeposit.value.toString(),
          depositUsers: homeDeposit.users.size,
          withdrawals: homeWithdrawal.length,
          withdrawalValue: homeWithdrawal.value.toString(),
          withdrawalUsers: homeWithdrawal.users.size
        },
        foreign: {
          deposits: foreignDeposit.length,
          depositValue: foreignDeposit.value.toString(),
          depositUsers: foreignDeposit.users.size,
          withdrawals: foreignWithdrawal.length,
          withdrawalValue: foreignWithdrawal.value.toString(),
          withdrawalUsers: foreignWithdrawal.users.size
        }
      }
    } catch (e) {
      throw e
    }
  }
}

module.exports = main