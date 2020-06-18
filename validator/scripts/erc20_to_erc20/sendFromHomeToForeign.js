const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})
const Web3Utils = require('web3-utils')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { isValidAmount } = require('../utils/utils')
const { checkRelayedMessage, web3Foreign, sleep, web3Home } = require('./utils')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_TEST_TX_GAS_PRICE,
  FOREIGN_CUSTOM_RECIPIENT,
  HOME_BLOCK_TIME,
} = process.env

const deployed = require('../../data/deployed.json')

const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const NUMBER_OF_WITHDRAWALS_TO_SEND = process.argv[2] || process.env.NUMBER_OF_WITHDRAWALS_TO_SEND || 1

const BRIDGE_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const ERC677_ABI = require('../../abis/ERC677BridgeToken.json').abi
let sent = 0
let success = 0

async function main() {
  while(true) {
    try {
      await run()
    } catch (e) {
      console.log(e, 'stress test raise error')
      await new Promise(r => setTimeout(r, 10 * 1000))
    } finally{
      console.log(`sent: ${sent}, success: ${success}`)
    }
  }
}

async function run() {
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
    }
  } catch (e) {
    console.log(e)
  }

  let receipt;
  let idx = 0
  while(!receipt && idx < NUMBER_OF_WITHDRAWALS_TO_SEND * HOME_BLOCK_TIME) {
    await sleep(1000)
    const c = toCheck[toCheck.length - 1]
    receipt = await web3Home.eth.getTransactionReceipt(c.transactionHash)
    console.log(`${idx}s - getting receipt ${c.transactionHash}`)
    idx++
  }

  const expect = {}
  let numToCheck = 0
  const promises = []
  const batch = new web3Home.BatchRequest()
  for (let i = 0; i < toCheck.length; i++) {
    const c = toCheck[i]
    promises.push(new Promise((resolve, reject) =>{
      batch.add(web3Home.eth.getTransactionReceipt.request(c.transactionHash, (err, receipt) =>{
        if (err) {
          reject(err)
        } else {
          if (receipt && receipt.status) {
            expect[c.transactionHash] = false
            numToCheck += 1
          }
          resolve(receipt)
        }
      }))
    }))
  }

  batch.execute()
  await Promise.all(promises)
  sent += numToCheck
  console.log('numToCheck=', numToCheck)

  let done = 0
  let retries = 0
  while (done < numToCheck) {
    await sleep(5000)
    const count = await checkRelayedMessage(expect)
    if (count === 0) {
      retries += 1
    } else {
      done += count
      success += count
      retries = 0
    }
    console.log(`done=${done}, total=${numToCheck}`)

    if (retries > 50) {
      console.log("remaining transactions:")
      for (let i = 0; i < toCheck.length; i++) {
        const c = toCheck[i];
        if (!expect[c.transactionHash]) {
          console.log(c)
        }
      }
      break
    }
  }
}

main()