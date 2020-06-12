const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const rpcUrlsManager = require('../../src/services/getRpcUrlsManager')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { checkAffirmationCompleted, web3Home, sleep, web3Foreign } = require('./utils')

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

async function main() {
  const bridge = new web3Foreign.eth.Contract(BRIDGE_ABI, FOREIGN_BRIDGE_ADDRESS)
  const ERC20_TOKEN_ADDRESS = await bridge.methods.erc20token().call()
  const poa20 = new web3Foreign.eth.Contract(ERC20_ABI, ERC20_TOKEN_ADDRESS)

  let homeStartBlock = await web3Home.eth.getBlockNumber()
  const toCheck = []

  try {
    const foreignChaindId = await sendRawTx({
      web3: web3Foreign,
      params: [],
      method: 'net_version',
    })
    let nonce = await sendRawTx({
      web3: web3Foreign,
      method: 'eth_getTransactionCount',
      params: [USER_ADDRESS, 'latest'],
    })
    const transferValue = Web3Utils.toWei(FOREIGN_MIN_AMOUNT_PER_TX)
    nonce = Web3Utils.hexToNumber(nonce)
    let actualSent = 0
    for (let i=0; i < Number(NUMBER_OF_DEPOSITS_TO_SEND); i++) {
      let balance = Number(await poa20.methods.balanceOf(USER_ADDRESS).call())
      while (balance < Number(transferValue)) {
        console.log(`user: ${USER_ADDRESS} balance: ${balance} < ${transferValue}, sleep 1...`)
        await sleep(1000)
        balance = Number(await poa20.methods.balanceOf(USER_ADDRESS).call())
      }

      console.log(`user: ${USER_ADDRESS}, balance: ${balance}`)
      let gasLimit = await poa20.methods
        .transfer(FOREIGN_BRIDGE_ADDRESS, transferValue)
        .estimateGas({ from: USER_ADDRESS })
      gasLimit *= 2
      console.log(`user: ${USER_ADDRESS}, gasLimit: ${gasLimit}`)
      let data = await poa20.methods
        .transfer(FOREIGN_BRIDGE_ADDRESS, transferValue)
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
  let receipt;
  while(!receipt) {
    await sleep(1000)
    const c = toCheck[toCheck.length - 1]
    receipt = await web3Foreign.eth.getTransactionReceipt(c.transactionHash)
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

  let retries = 0
  let done = 0
  while (done < numToCheck) {
    await sleep(5000)
    let homeToBlock = await web3Home.eth.getBlockNumber()
    homeToBlock = Math.min(homeToBlock, homeStartBlock + 100)
    const count = await checkAffirmationCompleted(homeStartBlock, homeToBlock, expect)
    if (count === 0) {
      retries += 1
    } else {
      done += count
      retries = 0
    }
    homeStartBlock = homeToBlock
    console.log('done=', done, 'to check', numToCheck)

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
