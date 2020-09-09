const path = require('path')
const Web3 = require('web3')
const assert = require('assert')
const promiseRetry = require('promise-retry')
const { user } = require('../constants.json')
const { generateNewBlock } = require('../utils/utils')

const homeWeb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8541'))
const foreignWeb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8542'))

const deployed = require('../data/deployed.json')
const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const { toBN } = foreignWeb3.utils

homeWeb3.eth.accounts.wallet.add(user.privateKey)
foreignWeb3.eth.accounts.wallet.add(user.privateKey)

const tokenAbi = require('../abis/ERC677BridgeToken.json').abi
const erc20Token = new foreignWeb3.eth.Contract(
  tokenAbi,
  deployed.erc20Token.address,
)
const erc677Token = new homeWeb3.eth.Contract(
  tokenAbi,
  deployed.homeBridge.erc677.address
)

describe('erc to erc', () => {
  it('should convert tokens in foreign to tokens in home', async () => {
    const balance = await erc20Token.methods.balanceOf(user.address).call()
    assert(!toBN(balance).isZero(), 'Account should have tokens')
    console.log("foreign origin balance:", balance)

    const homeBalance = await erc677Token.methods.balanceOf(user.address).call()
    console.log("home origin balance:", homeBalance)

    // send tokens to foreign bridge
    const tx = await erc20Token.methods
      .transfer(FOREIGN_BRIDGE_ADDRESS, homeWeb3.utils.toWei('5'))
      .send({
        from: user.address,
        gas: '1000000'
      })
      .catch(e => {
        console.error(e)
      })

    const foreignNewBalance = await erc20Token.methods.balanceOf(user.address).call()
    console.log("foreign new balance:", foreignNewBalance)

    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(foreignWeb3, user.address)

    // check that balance increases
    await promiseRetry(async retry => {
      const balance = await erc677Token.methods.balanceOf(user.address).call()
      console.log("home new balance:", balance)
      if (toBN(balance).isZero()) {
        retry()
      }
    })
  })
  it('should convert tokens in home to tokens in foreign', async () => {
    const originalBalance = await erc20Token.methods.balanceOf(user.address).call()
    console.log("foreign origin balance:", originalBalance)

    // check that account has tokens in home chain
    const balance = await erc677Token.methods.balanceOf(user.address).call()
    assert(!toBN(balance).isZero(), 'Account should have tokens')
    console.log("home origin balance:", balance)

    let status = false
    let depositTx;
    while (!status) {
      // send transaction to home bridge
      depositTx = await erc677Token.methods
        .transferAndCall(HOME_BRIDGE_ADDRESS, homeWeb3.utils.toWei('1'), '0x')
        .send({
          from: user.address,
          gas: '10000000'
        })
        .catch(e => {
          console.error(e)
        })
      status = depositTx.status
      console.log(depositTx.transactionHash, status)
    }
    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(homeWeb3, user.address)

    const homeNewBalance = await erc677Token.methods.balanceOf(user.address).call()
    console.log("home new balance:", homeNewBalance)

    // The bridge should create a new transaction with a CollectedSignatures
    // event so we generate another trivial transaction
    await promiseRetry(
      async retry => {
        const lastBlockNumber = await homeWeb3.eth.getBlockNumber()
        if (lastBlockNumber >= depositTx.blockNumber + 2) {
          await generateNewBlock(homeWeb3, user.address)
        } else {
          retry()
        }
      },
      {
        forever: true,
        factor: 1,
        minTimeout: 500
      }
    )

    // check that balance increases
    await promiseRetry(async retry => {
      const balance = await erc20Token.methods.balanceOf(user.address).call()
      console.log("foreign new balance:", balance)
      if (toBN(balance).lte(toBN(originalBalance))) {
        retry()
      }
    })
  })
})
