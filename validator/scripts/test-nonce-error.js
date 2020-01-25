const process = require('process')
const fs = require('fs')
const HttpListProvider = require('http-list-provider')
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const { privateKeyToAddress, nonceError } = require('../src/utils/utils')

process.env.HOME_RPC_URL = 'https://mainnet-rpc.thundercore.com'
process.env.FOREIGN_RPC_URL = 'https://cloudflare-eth.com'
const { sendTx, sendRawTx } = require('../src/tx/sendTx')

function printUsageExit() {
  process.stderr.write('usage: test-nonce-error PRIVATE_KEY_FILE\n')
  process.exit(2)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    printUsageExit()
  }
  const privateKey = fs.readFileSync(args[0], { encoding: 'ascii' }).trim()
  console.log('privateKey:', privateKey)

  const rpcUrl = 'https://mainnet-rpc.thundercore.com'

  const provider = new HttpListProvider(rpcUrl)
  const web3Instance = new Web3(provider)

  const chain = 'home'
  const fromAddr = privateKeyToAddress(privateKey)
  console.log('addr:', fromAddr)

  // console.log('pre net_version')
  const chainId = await sendRawTx({
    chain,
    params: [],
    method: 'net_version'
  })
  console.log('net_version:', chainId)
  // console.log('pre eth_getTransactionCount')
  let nonce = await sendRawTx({
    chain,
    method: 'eth_getTransactionCount',
    params: [fromAddr, 'latest']
  })
  nonce = Web3Utils.hexToNumber(nonce)
  console.log('eth_getTransactionCount:', nonce)
  nonce--
  console.log('nonce:', nonce)
  const toAddr = fromAddr
  const gasPrice = 1000 * 1000 * 1000
  const gasLimit = 21000

  console.log('pre sendTx')
  let result
  try {
    const input = {
      chain: 'home',
      privateKey,
      nonce,
      gasPrice: gasPrice.toString(),
      amount: '0',
      gasLimit: gasLimit.toString(),
      to: toAddr,
      chainId,
      web3: web3Instance
    }
    // console.log('input:', input)
    result = await sendTx(input)
  } catch (e) {
    if (nonceError(e)) {
      console.log('PASSED: got nonceError(e):', e)
      process.exit(0)
    }
    console.log('FAILED: error:', e)
    process.exit(1)
  }
  console.log('FAILED: result:', result)
  process.exit(1)
}

;(async () => main())()
