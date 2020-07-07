const BN = require('bignumber.js')
const Web3 = require('web3')
const { BRIDGE_MODES } = require('./utils/bridgeMode')
const HttpRetryProvider = require('./utils/httpRetryProvider')

const ERC20_ABI = require('./abis/ERC20.abi')
const ERC677_ABI = require('./abis/ERC677.abi')
const HOME_ERC_TO_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')
const FOREIGN_ERC_TO_ERC_ABI = require('./abis/ForeignBridgeErcToErc.abi')

function main({ HOME_RPC_URL, FOREIGN_RPC_URL, HOME_BRIDGE_ADDRESS, FOREIGN_BRIDGE_ADDRESS }) {
  return async function main(bridgeMode) {
    const homeProvider = new HttpRetryProvider(HOME_RPC_URL.split(","))
    const web3Home = new Web3(homeProvider)

    const foreignProvider = new HttpRetryProvider(FOREIGN_RPC_URL.split(","))
    const web3Foreign = new Web3(foreignProvider)

    try {
      if (bridgeMode === BRIDGE_MODES.ERC_TO_ERC) {
        const foreignBridge = new web3Foreign.eth.Contract(
          FOREIGN_ERC_TO_ERC_ABI,
          FOREIGN_BRIDGE_ADDRESS
        )
        const erc20Address = await foreignBridge.methods.erc20token().call()
        const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, erc20Address)
        const foreignErc20Balance = await erc20Contract.methods
          .balanceOf(FOREIGN_BRIDGE_ADDRESS)
          .call()
        const decimals = await erc20Contract.methods.decimals().call()
        const base = (new BN('10')).pow(Number(decimals))
        const homeBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, HOME_BRIDGE_ADDRESS)
        const tokenAddress = await homeBridge.methods.erc677token().call()
        const tokenContract = new web3Home.eth.Contract(ERC677_ABI, tokenAddress)
        const totalSupply = await tokenContract.methods.totalSupply().call()
        const foreignBalanceBN = new BN(foreignErc20Balance)
        const foreignTotalSupply = await erc20Contract.methods.totalSupply().call()
        const homeTotalSupplyBN = new BN(totalSupply)
        const diff = foreignBalanceBN.minus(homeTotalSupplyBN).toString(10)

        return {
          time: new Date().toISOString(),
          home: {
            totalSupply: new BN(totalSupply).idiv(base).toString()
          },
          foreign: {
            totalSupply: new BN(foreignTotalSupply).idiv(base).toString(),
            erc20Balance: new BN(foreignErc20Balance).idiv(base).toString()
          },
          balanceDiff: Number(new BN(diff).idiv(base).toString()),
          lastChecked: Math.floor(Date.now() / 1000)
        }
      } else {
        throw new Error(`Unrecognized bridge mode: '${bridgeMode}'`)
      }
    } catch (e) {
      throw e
    }
  }
}

module.exports = main