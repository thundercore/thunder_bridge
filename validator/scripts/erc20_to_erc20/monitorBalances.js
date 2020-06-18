const BN = require('bignumber.js')

const { web3Foreign, sleep, web3Home } = require('./utils')

const deployed = require('../../data/deployed.json')
const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const ERC20_ABI = require('../../abis/ERC677BridgeToken').abi
const ERC677_ABI = require('../../abis/ERC677BridgeToken').abi
const HOME_ERC_TO_ERC_ABI = require('../../abis/HomeBridgeErcToErc.abi')
const FOREIGN_ERC_TO_ERC_ABI = require('../../abis/ForeignBridgeErcToErc.abi')

async function main() {
  while(true) {
    try {
      await checkBalances()
    } catch (e) {
      console.log(e)
    } finally {
      await sleep(10 * 60 * 1000)
    }
  }
}

async function checkBalances() {
  try {
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
    const foreignTotalSupplyBN = new BN(totalSupply)
    const diff = foreignBalanceBN.minus(foreignTotalSupplyBN).toString(10)

    console.log({
      now: new Date().toISOString(),
      home: {
        totalSupply: new BN(totalSupply).idiv(base).toString()
      },
      foreign: {
        erc20Balance: new BN(foreignErc20Balance).idiv(base).toString()
      },
      balanceDiff: Number(new BN(diff).idiv(base).toString()),
      lastChecked: Math.floor(Date.now() / 1000)
    })
  } catch (e) {
    throw e
  }
}

main()