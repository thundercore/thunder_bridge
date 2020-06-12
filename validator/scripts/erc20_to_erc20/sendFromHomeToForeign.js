const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const rpcUrlsManager = require('../../src/services/getRpcUrlsManager')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { isValidAmount } = require('../utils/utils')
const { checkRelayedMessage, web3Foreign, sleep, web3Home } = require('./utils')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_TEST_TX_GAS_PRICE,
  FOREIGN_CUSTOM_RECIPIENT,
} = process.env

const deployed = require('../../data/deployed.json')

const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const NUMBER_OF_WITHDRAWALS_TO_SEND = process.argv[2] || process.env.NUMBER_OF_WITHDRAWALS_TO_SEND || 1

const BRIDGE_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const ERC677_ABI = require('../../abis/ERC677BridgeToken.json').abi

async function main() {
  const bridge = new web3Home.eth.Contract(BRIDGE_ABI, HOME_BRIDGE_ADDRESS)
  const BRIDGEABLE_TOKEN_ADDRESS = await bridge.methods.erc677token().call()
  const erc677 = new web3Home.eth.Contract(ERC677_ABI, BRIDGEABLE_TOKEN_ADDRESS)

  let foreignStartBlock = await web3Foreign.eth.getBlockNumber()
  const toCheck = []

  try {
    await isValidAmount(HOME_MIN_AMOUNT_PER_TX, bridge)

    const homeChainId = await sendRawTx({
      web3: web3Home,
      params: [],
      method: 'net_version',
    })
    let nonce = await sendRawTx({
      web3: web3Home,
      method: 'eth_getTransactionCount',
      params: [USER_ADDRESS, 'latest'],
    })
    nonce = Web3Utils.hexToNumber(nonce)
    let actualSent = 0
    const transferValue = Web3Utils.toWei(HOME_MIN_AMOUNT_PER_TX)
    for (let i = 0; i < Number(NUMBER_OF_WITHDRAWALS_TO_SEND); i++) {
      let balance = Number(await erc677.methods.balanceOf(USER_ADDRESS).call())
      while (balance < Number(transferValue)) {
        console.log(`user: ${USER_ADDRESS} balance: ${balance} < ${transferValue}, sleep 1...`)
        await sleep(1000)
        balance = Number(await erc677.methods.balanceOf(USER_ADDRESS).call())
      }

      console.log(`Balance of ${USER_ADDRESS}: ${balance}`)
      let gasLimit = await erc677.methods
        .transferAndCall(HOME_BRIDGE_ADDRESS, transferValue, '0x')
        .estimateGas({ from: USER_ADDRESS })
      gasLimit *= 2
      console.log(`user: ${USER_ADDRESS}, gasLimit: ${gasLimit}`)
      let data = await erc677.methods
        .transferAndCall(HOME_BRIDGE_ADDRESS, transferValue, '0x')
        .encodeABI({ from: USER_ADDRESS })
      if (FOREIGN_CUSTOM_RECIPIENT) {
        data += `000000000000000000000000${FOREIGN_CUSTOM_RECIPIENT.slice(2)}`
        gasLimit += 50000
      }
      const tx = {
        chain: 'home',
        privateKey: USER_ADDRESS_PRIVATE_KEY,
        data,
        nonce,
        gasPrice: HOME_TEST_TX_GAS_PRICE,
        amount: '0',
        gasLimit,
        to: BRIDGEABLE_TOKEN_ADDRESS,
        web3: web3Home,
        chainId: homeChainId,
      }
      const txHash = await sendTx(tx)
      if (txHash !== undefined) {
        nonce++
        actualSent++
        console.log(actualSent, ' # ', txHash)
        toCheck.push({
          transactionHash: txHash,
          value: Web3Utils.toWei(HOME_MIN_AMOUNT_PER_TX),
          recipient: USER_ADDRESS,
          result: '',
        })
      }
      const r = await web3Home.eth.getTransactionReceipt(txHash)
      if (r !== null) {
        console.log(txHash, r.status)
      }
    }
  } catch (e) {
    console.log(e)
  }

  let receipt;
  while(!receipt) {
    await sleep(1000)
    const c = toCheck[toCheck.length - 1]
    receipt = await web3Home.eth.getTransactionReceipt(c.transactionHash)
  }


  const expect = {}
  let numToCheck = 0
  for (let i = 0; i < toCheck.length; i++) {
    const c = toCheck[i]
    const receipt = await web3Home.eth.getTransactionReceipt(c.transactionHash)
    if (receipt && receipt.status) {
      expect[c.transactionHash] = c
      numToCheck += 1
    }
  }

  console.log('numToCheck=', numToCheck)

  let done = 0
  let retries = 0
  while (done < numToCheck) {
    await sleep(5000)
    let foreignToBlock = await web3Foreign.eth.getBlockNumber()
    foreignToBlock = Math.min(foreignToBlock, foreignStartBlock + 100)
    const count = await checkRelayedMessage(foreignStartBlock, foreignToBlock, expect)
    if (count === 0) {
      retries += 1
    } else {
      done += count
      retries = 0
    }
    foreignStartBlock = foreignToBlock
    console.log(`done=${done}, total=${numToCheck}`)

    if (retries > 50) {
      console.log("remaining transactions:")
      for (let i = 0; i < toCheck.length; i++) {
        const c = toCheck[i];
        if (expect[c.transactionHash] && expect[c.transactionHash].result !== 'success') {
          console.log(c)
        }
      }
      process.exit(17)
    }

  }
}
main()
