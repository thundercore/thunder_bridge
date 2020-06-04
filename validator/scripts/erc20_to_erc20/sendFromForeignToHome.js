const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env')
})
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const rpcUrlsManager = require('../../src/services/getRpcUrlsManager')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_TEST_TX_GAS_PRICE,
  HOME_CUSTOM_RECIPIENT
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

  try {
    const foreignChaindId = await sendRawTx({
      chain: 'foreign',
      params: [],
      method: 'net_version'
    })
    let nonce = await sendRawTx({
      chain: 'foreign',
      method: 'eth_getTransactionCount',
      params: [USER_ADDRESS, 'latest']
    })
    nonce = Web3Utils.hexToNumber(nonce)
    let actualSent = 0
    for (let i = 0; i < Number(NUMBER_OF_DEPOSITS_TO_SEND); i++) {
      let balance = await poa20.methods.balanceOf(USER_ADDRESS).call()
      console.log(`user: ${USER_ADDRESS}, balance: ${balance}`)
      let gasLimit = await poa20.methods
        .transfer(FOREIGN_BRIDGE_ADDRESS, Web3Utils.toWei(FOREIGN_MIN_AMOUNT_PER_TX))
        .estimateGas({ from: USER_ADDRESS })
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
        chainId: foreignChaindId
      }
      const txHash = await sendTx(txConfig)
      if (txHash !== undefined) {
        nonce++
        actualSent++
        console.log(actualSent, ' # ', txHash)
      }
    }
  } catch (e) {
    console.log(e)
  }
}
main()
