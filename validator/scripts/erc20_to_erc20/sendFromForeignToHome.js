const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env'),
})
const Web3Utils = require('web3-utils')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { checkAffirmationCompleted, sleep, web3Foreign, checkBalances } = require('./utils')

const Sentry = require('@sentry/node')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_TEST_TX_GAS_PRICE,
  HOME_CUSTOM_RECIPIENT,
  FOREIGN_BLOCK_TIME,
} = process.env

const deployed = require('../../data/deployed.json')

const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address

const RETRY_LIMIT = process.env.RETRY_LIMIT || 50

const ERC20_ABI = require('../../abis/ERC20.abi')
const BRIDGE_ABI = require('../../abis/ForeignBridgeErcToErc.abi')

var originalConsoleLog = console.log;
console.log = function() {
    args = [];
    args.push('[FOREIGN]')
    // Note: arguments is part of the prototype
    for( var i = 0; i < arguments.length; i++ ) {
        args.push( arguments[i] );
    }
    originalConsoleLog.apply( console, args );
};

async function sendFromForeignToHome(numberToSend) {
  const bridge = new web3Foreign.eth.Contract(BRIDGE_ABI, FOREIGN_BRIDGE_ADDRESS)
  const ERC20_TOKEN_ADDRESS = await bridge.methods.erc20token().call()
  const poa20 = new web3Foreign.eth.Contract(ERC20_ABI, ERC20_TOKEN_ADDRESS)

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
    for (let i=0; i < Number(numberToSend); i++) {
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
  let idx = 0
  while(!receipt && idx < numberToSend * FOREIGN_BLOCK_TIME) {
    await sleep(1000)
    const c = toCheck[toCheck.length - 1]
    receipt = await web3Foreign.eth.getTransactionReceipt(c.transactionHash)
    console.log(`${idx}s - getting receipt ${c.transactionHash}`)
    idx++
  }

  const expect = {}
  let numToCheck = 0
  const promises = []
  const batch = new web3Foreign.BatchRequest()
  for (let i = 0; i < toCheck.length; i++) {
    const c = toCheck[i]
    promises.push(new Promise((resolve, reject) =>{
      batch.add(web3Foreign.eth.getTransactionReceipt.request(c.transactionHash, (err, receipt) =>{
        if (err) {
          reject(err)
        } else {
          if (receipt && receipt.status) {
            expect[c.transactionHash] = c
            numToCheck += 1
          }
          resolve(receipt)
        }
      }))
    }))
  }

  batch.execute()
  await Promise.all(promises)

  console.log('numToCheck=', numToCheck)

  let retries = 0
  let done = 0
  while (done < numToCheck) {
    await sleep(5000)
    const count = await checkAffirmationCompleted(expect)
    if (count === 0) {
      retries += 1
    } else {
      done += count
      retries = 0
    }
    console.log('done=', done, 'to check', numToCheck)

    if (retries > RETRY_LIMIT) {
      console.log("remaining transactions:")
      for (let i = 0; i < toCheck.length; i++) {
        const c = toCheck[i];
        if (expect[c.transactionHash]) {
          Sentry.addBreadcrumb({
            category: 'stressTest',
            message: 'failed transactions',
            data: c.transactionHash,
            level: Sentry.Severity.Debug
          })
          console.log(c)
        }
      }
      Sentry.captureMessage('stress test foreign -> home failed')
      break
    }
  }

  return {done, numToCheck}
}

module.exports = {
  sendFromForeignToHome
}