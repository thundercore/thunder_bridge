const Web3 = require('web3')
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
const web3Home = new Web3(new Web3WsProvider('wss://testnet-ws.thundercore.com', options))

const HOME_BRIDGE_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const FOREIGN_BRIDGE_ABI = require('../../abis/ForeignBridgeErcToErc.abi')

const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address
const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address

const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_BRIDGE_ABI, FOREIGN_BRIDGE_ADDRESS)
const homeBridge = new web3Home.eth.Contract(HOME_BRIDGE_ABI, HOME_BRIDGE_ADDRESS)

// Check send from foreign to home is completed
async function checkAffirmationCompleted(fromBlock, toBlock, expect) {
  console.log('check affirmation completed event', fromBlock, toBlock)
  const events = await homeBridge.getPastEvents('AffirmationCompleted', {
    fromBlock,
    toBlock,
  })

  let count = 0
  events.forEach((e) => {
    const referenceTxHash = e.returnValues.transactionHash
    if (expect[referenceTxHash]) {
      const transfer = expect[referenceTxHash]
      if (transfer.result === 'success') {
        return
      }

      transfer.result = 'success'

      if (transfer.recipient !== e.returnValues.recipient) {
        console.log('recipient not equal')
        console.log('want=', transfer)
        console.log('got=', e.returnValues)
        transfer.result = 'fail'
      }

      if (transfer.value !== e.returnValues.value) {
        console.log('value not equal')
        console.log('want=', transfer)
        console.log('got=', e.returnValues)
        transfer.result = 'fail'
      }

      if (transfer.result === 'success') {
        count += 1
      }
    }
  })
  return count
}

// Check send from home to foreign is completed
async function checkRelayedMessage(fromBlock, toBlock, expect) {
  console.log('check relayed message event', fromBlock, toBlock)
  const events = await foreignBridge.getPastEvents('RelayedMessage', {
    fromBlock,
    toBlock,
  })

  let count = 0
  events.forEach((e) => {
    const referenceTxHash = e.returnValues.transactionHash
    if (expect[referenceTxHash]) {
      const transfer = expect[referenceTxHash]
      if (transfer.result === 'success') {
        return
      }

      transfer.result = 'success'

      if (transfer.recipient !== e.returnValues.recipient) {
        console.log('recipient not equal')
        console.log('want=', transfer)
        console.log('got=', e.returnValues)
        transfer.result = 'fail'
      }

      if (transfer.value !== e.returnValues.value) {
        console.log('value not equal')
        console.log('want=', transfer)
        console.log('got=', e.returnValues)
        transfer.result = 'fail'
      }

      if (transfer.result === 'success') {
        count += 1
      }
    }
  })
  return count
}

function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(resolve, t)
  })
}

module.exports = {
  checkAffirmationCompleted,
  checkRelayedMessage,
  web3Home,
  web3Foreign,
  sleep,
}
