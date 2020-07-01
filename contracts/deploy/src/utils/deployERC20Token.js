const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  NODE_ENV,
  USER_ADDRESS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function mintAddress(erc677token, address, nonce) {
  const mintData = await erc677token.methods
    .mint(address, '10000000000000000000')
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })

  const txMint = await sendRawTxForeign({
    data: mintData,
    nonce: nonce,
    to: erc677token.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })

  assert.strictEqual(Web3Utils.hexToNumber(txMint.status), 1, 'Transaction Failed')
}

async function deployToken() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n[Foreign] deploying ERC20 token')
  const erc677token = await deployContract(
    ERC677BridgeToken,
    [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
  )
  foreignNonce++
  console.log('[Foreign] ERC20 Token: ', erc677token.options.address)

  if (NODE_ENV === 'test' && USER_ADDRESS) {
    console.log(`[Foreign] minting 100 tokens to ${USER_ADDRESS} for test`)
    await mintAddress(erc677token, USER_ADDRESS, foreignNonce)
    foreignNonce++
  } else {
    console.log('[Foreign] minting 100 tokens and transfer them to ', DEPLOYMENT_ACCOUNT_ADDRESS)
    await mintAddress(erc677token, DEPLOYMENT_ACCOUNT_ADDRESS, foreignNonce)
    foreignNonce++
  }

  console.log('\nToken deployment is completed\n')
  return {
    erc677tokenAddress: erc677token.options.address
  }
}
module.exports = deployToken
