const Web3 = require('web3')
const BN = require('bignumber.js')
const Sentry = require('@sentry/node')
const Web3WsProvider = require('web3-providers-ws');
const deployed = require('../../data/deployed.json')
const { web3Foreign } = require('../../src/services/web3')

const options = {
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 5,
    onTimeout: false
  }
}
const { HOME_RPC_URL } = process.env
const web3Home = new Web3(new Web3WsProvider(HOME_RPC_URL, options))

const HOME_BRIDGE_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const FOREIGN_BRIDGE_ABI = require('../../abis/ForeignBridgeErcToErc.abi')
const ERC677_ABI = require('../../abis/ERC677BridgeToken.json').abi

const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address
const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address

const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_BRIDGE_ABI, FOREIGN_BRIDGE_ADDRESS)
const homeBridge = new web3Home.eth.Contract(HOME_BRIDGE_ABI, HOME_BRIDGE_ADDRESS)

const isAlreadyProcessed = (signed) => {
    return signed >= Math.pow(2, 255)
}

function getAffirmationHashMsg(recipient, value, txHash) {
  const hashMsg = web3Home.utils.soliditySha3(
    { type: 'address', value: recipient },
    { type: 'uint256', value: value },
    { type: 'bytes32', value: txHash }
  )
  return hashMsg
}

// Check send from foreign to home is completed
async function checkAffirmationCompleted(expect) {
  const batch = new web3Home.BatchRequest()

  const promises = []
  const completed = {}

  for (const tx in expect) {
    const transfer = expect[tx]
    promises.push(new Promise((resolve, reject) => {
      const hashMsg = getAffirmationHashMsg(transfer.recipient, transfer.value, tx)
      const request = homeBridge.methods.numAffirmationsSigned(hashMsg).call.request({}, (err, signed) => {
        if (err) {
          reject(err)
        } else {
          if (isAlreadyProcessed(signed)) {
            completed[tx] = true
          }
          resolve(signed)
        }
      })
      batch.add(request)
    }))
  }

  batch.execute()
  await Promise.all(promises)

  let count = 0
  for (const tx in expect) {
    if (completed[tx]) {
      delete expect[tx]
      count++
    }
  }

  return count
}

// Check send from home to foreign is completed
async function checkRelayedMessage(expect) {
  const batch = new web3Foreign.BatchRequest();
  const relayed = {}
  const promises = []
  for (const tx in expect) {
    promises.push(new Promise((resolve, reject) => {
      batch.add(foreignBridge.methods.relayedMessages(tx).call.request({}, (error, data) => {
        if (error) {
          reject(error)
        } else {
          relayed[tx] = data
          resolve(data)
        }
      }))
    }))
  }
  batch.execute()

  await Promise.all(promises)

  let count = 0
  for (const tx in expect) {
    if (relayed[tx]) {
      delete expect[tx]
      count++
    }
  }

  return count
}

function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(resolve, t)
  })
}

function initSentry() {
  Sentry.init(
    {dsn: process.env.SENTRY_DSN}
  )
  Sentry.captureMessage('init test')
}

async function checkBalances() {
  try {
    const erc20Address = await foreignBridge.methods.erc20token().call()
    const erc20Contract = new web3Foreign.eth.Contract(ERC677_ABI, erc20Address)
    const foreignErc20Balance = await erc20Contract.methods
      .balanceOf(FOREIGN_BRIDGE_ADDRESS)
      .call()
    const decimals = await erc20Contract.methods.decimals().call()
    const base = (new BN('10')).pow(Number(decimals))
    const tokenAddress = await homeBridge.methods.erc677token().call()
    const tokenContract = new web3Home.eth.Contract(ERC677_ABI, tokenAddress)
    const totalSupply = await tokenContract.methods.totalSupply().call()
    const foreignBalanceBN = new BN(foreignErc20Balance)
    const foreignTotalSupplyBN = new BN(totalSupply)
    const diff = foreignBalanceBN.minus(foreignTotalSupplyBN).toString(10)

    return {
      now: new Date().toISOString(),
      home: {
        totalSupply: new BN(totalSupply).idiv(base).toString()
      },
      foreign: {
        erc20Balance: new BN(foreignErc20Balance).idiv(base).toString()
      },
      balanceDiff: Number(new BN(diff).idiv(base).toString()),
      lastChecked: Math.floor(Date.now() / 1000)
    }
  } catch (e) {
    throw e
  }
}

module.exports = {
  checkAffirmationCompleted,
  checkRelayedMessage,
  web3Home,
  web3Foreign,
  sleep,
  initSentry,
  checkBalances,
}
