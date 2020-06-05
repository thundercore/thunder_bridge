const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const rpcUrlsManager = require('../../src/services/getRpcUrlsManager')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { checkAffirmationCompleted, web3Home, sleep } = require('./utils')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_TEST_TX_GAS_PRICE,
  HOME_CUSTOM_RECIPIENT,
} = process.env

const deployed = require('../../data/deployed.json')

const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address

const NUMBER_OF_DEPOSITS_TO_SEND = process.argv[2] || process.env.NUMBER_OF_DEPOSITS_TO_SEND || 1

const ERC20_ABI = require('../../abis/ERC20.abi')
const BRIDGE_ABI = require('../../abis/ForeignBridgeErcToErc.abi')

const foreignRpcUrl = rpcUrlsManager.foreignUrls[0]
const foreignProvider = new Web3.providers.HttpProvider(foreignRpcUrl)
const web3Foreign = new Web3(foreignProvider)

async function main() {
  const bridge = new web3Foreign.eth.Contract(BRIDGE_ABI, FOREIGN_BRIDGE_ADDRESS)
  const ERC20_TOKEN_ADDRESS = await bridge.methods.erc20token().call()
  const poa20 = new web3Foreign.eth.Contract(ERC20_ABI, ERC20_TOKEN_ADDRESS)

  let homeStartBlock = await web3Home.eth.getBlockNumber()
  const toCheck = []

  try {
    const foreignChaindId = await sendRawTx({
      chain: 'foreign',
      params: [],
      method: 'net_version',
    })
    let nonce = await sendRawTx({
      chain: 'foreign',
      method: 'eth_getTransactionCount',
      params: [USER_ADDRESS, 'latest'],
    })
    nonce = Web3Utils.hexToNumber(nonce)
    let actualSent = 0
    for (let i = 0; i < Number(NUMBER_OF_DEPOSITS_TO_SEND); i++) {
      if (i % 10 === 0) {
        await sleep(100)
      }
      const balance = await poa20.methods.balanceOf(USER_ADDRESS).call()
      console.log(`user: ${USER_ADDRESS}, balance: ${balance}`)
      let gasLimit = await poa20.methods
        .transfer(FOREIGN_BRIDGE_ADDRESS, Web3Utils.toWei(FOREIGN_MIN_AMOUNT_PER_TX))
        .estimateGas({ from: USER_ADDRESS })
      gasLimit *= 2
      console.log(`user: ${USER_ADDRESS}, gasLimit: ${gasLimit}`)
      let data = await poa20.methods
        .transfer(FOREIGN_BRIDGE_ADDRESS, Web3Utils.toWei(FOREIGN_MIN_AMOUNT_PER_TX))
        .encodeABI({ from: USER_ADDRESS })
      if (HOME_CUSTOM_RECIPIENT) {
        data += `000000000000000000000000${HOME_CUSTOM_RECIPIENT.slice(2)}`
        gasLimit += 50000
      }
      const txConfig = {
        chain: 'foreign',
        privateKey: USER_ADDRESS_PRIVATE_KEY,
        data,
        nonce,
        gasPrice: FOREIGN_TEST_TX_GAS_PRICE,
        amount: '0',
        gasLimit,
        to: ERC20_TOKEN_ADDRESS,
        web3: web3Foreign,
        chainId: foreignChaindId,
      }
      const txHash = await sendTx(txConfig)
      if (txHash !== undefined) {
        nonce++
        actualSent++
        console.log(actualSent, ' # ', txHash)
        toCheck.push({
          transactionHash: txHash,
          value: Web3Utils.toWei(FOREIGN_MIN_AMOUNT_PER_TX),
          recipient: USER_ADDRESS,
          result: '',
        })
      }
    }
  } catch (e) {
    console.log(e)
  }

  // wait for last tx
  for (let i = 0; i < 15; i++) {
    await sleep(1000)
    const c = toCheck[toCheck.length - 1]
    const receipt = await web3Foreign.eth.getTransactionReceipt(c.transactionHash)
    if (receipt) {
      break
    }
  }

  const expect = {}
  let numToCheck = 0
  for (let i = 0; i < toCheck.length; i++) {
    const c = toCheck[i]
    const receipt = await web3Foreign.eth.getTransactionReceipt(c.transactionHash)
    if (receipt && receipt.status) {
      expect[c.transactionHash] = c
      numToCheck += 1
    }
  }

  console.log('numToCheck=', numToCheck)

  let done = 0
  while (done < numToCheck) {
    await sleep(5000)
    let homeToBlock = await web3Home.eth.getBlockNumber()
    homeToBlock = Math.min(homeToBlock, homeStartBlock + 10)
    const count = await checkAffirmationCompleted(homeStartBlock, homeToBlock, expect)
    done += count
    homeStartBlock = homeToBlock
    console.log('done=', done, 'to check', toCheck.length)
  }
  console.log('oh ya')
}

main()
