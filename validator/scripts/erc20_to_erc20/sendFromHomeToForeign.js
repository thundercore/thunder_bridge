const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../../.env')
})
const Web3 = require('web3')
const Web3Utils = require('web3-utils')
const rpcUrlsManager = require('../../src/services/getRpcUrlsManager')
const { sendTx, sendRawTx } = require('../../src/tx/sendTx')
const { isValidAmount } = require('../utils/utils')

const {
  USER_ADDRESS,
  USER_ADDRESS_PRIVATE_KEY,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_TEST_TX_GAS_PRICE,
  FOREIGN_CUSTOM_RECIPIENT
} = process.env

const deployed = require('../../data/deployed.json')
const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const NUMBER_OF_WITHDRAWALS_TO_SEND =
  process.argv[2] || process.env.NUMBER_OF_WITHDRAWALS_TO_SEND || 1

const BRIDGE_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const ERC677_ABI = require('../../abis/ERC677BridgeToken.json').abi

const homeRpcUrl = rpcUrlsManager.homeUrls[0]
const homeProvider = new Web3.providers.HttpProvider(homeRpcUrl)
const web3Home = new Web3(homeProvider)

async function main() {
  const bridge = new web3Home.eth.Contract(BRIDGE_ABI, HOME_BRIDGE_ADDRESS)
  const BRIDGEABLE_TOKEN_ADDRESS = await bridge.methods.erc677token().call()
  const erc677 = new web3Home.eth.Contract(ERC677_ABI, BRIDGEABLE_TOKEN_ADDRESS)

  try {
    await isValidAmount(HOME_MIN_AMOUNT_PER_TX, bridge)

    const homeChainId = await sendRawTx({
      chain: 'home',
      params: [],
      method: 'net_version'
    })
    let nonce = await sendRawTx({
      chain: 'home',
      method: 'eth_getTransactionCount',
      params: [USER_ADDRESS, 'latest']
    })
    nonce = Web3Utils.hexToNumber(nonce)
    let actualSent = 0
    for (let i = 0; i < Number(NUMBER_OF_WITHDRAWALS_TO_SEND); i++) {
      const balance = await erc677.methods.balanceOf(USER_ADDRESS).call()
      console.log(`Balance of ${USER_ADDRESS}: ${balance}`)
      let gasLimit = await erc677.methods
        .transferAndCall(HOME_BRIDGE_ADDRESS, Web3Utils.toWei(HOME_MIN_AMOUNT_PER_TX), '0x')
        .estimateGas({ from: USER_ADDRESS })
      let data = await erc677.methods
        .transferAndCall(HOME_BRIDGE_ADDRESS, Web3Utils.toWei(HOME_MIN_AMOUNT_PER_TX), '0x')
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
        chainId: homeChainId
      }
      const txHash = await sendTx(tx)
      if (txHash !== undefined) {
        nonce++
        actualSent++
        console.log(actualSent, ' # ', txHash)
      }
      const r = await web3Home.eth.getTransactionReceipt(txHash)
      if (r !== null) {
        console.log(txHash, r.status)
      }
    }
  } catch (e) {
    console.log(e)
  }
}
main()
