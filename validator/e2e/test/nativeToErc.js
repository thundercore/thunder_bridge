const path = require('path')
const Web3 = require('web3')
const assert = require('assert')
const promiseRetry = require('promise-retry')
const { user, validator, temp } = require('../constants.json')
const { generateNewBlock } = require('../utils/utils')

const homeWeb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8541'))
const foreignWeb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8542'))

const deployed = require('../data/deployed.json')
const FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
const HOME_BRIDGE_ADDRESS = deployed.homeBridge.address

const { toBN } = foreignWeb3.utils

const account1 = homeWeb3.eth.accounts.create()
const account2 = homeWeb3.eth.accounts.create()

for (let account of [user, validator, temp, account1, account2]) {
  homeWeb3.eth.accounts.wallet.add(account.privateKey)
  foreignWeb3.eth.accounts.wallet.add(account.privateKey)
}

const tokenAbi = require('../abis/ERC677BridgeToken.abi')
const token = new homeWeb3.eth.Contract(tokenAbi, deployed.homeBridge.erc677.address)

const sleep = timeout => new Promise(res => setTimeout(res, timeout))

// Skip test because thunder only deploy `erc-to-erc` bridge.
describe('native to erc', () => {
  before(async ()=> {
    for (let account of [account1, account2]) {
      await foreignWeb3.eth.sendTransaction({
        from: user.address,
        to: account.address,
        gasPrice: '10000000000',
        gas: '50000',
        value: Web3.utils.toWei('10')
      })

      await homeWeb3.eth.sendTransaction({
        from: user.address,
        to: account.address,
        gasPrice: '10000000000',
        gas: '50000',
        value: Web3.utils.toWei('10')
      })
    }
  })

  it('foreign (eth) -> home (token)', async () => {
    // check that account has zero tokens in the foreign chain
    const balance = await token.methods.balanceOf(account1.address).call()
    assert(toBN(balance).isZero(), 'Account should not have tokens yet')

    // account1 send one ether to home chain
    const depositTx = await foreignWeb3.eth.sendTransaction({
      from: account1.address,
      to: FOREIGN_BRIDGE_ADDRESS,
      gasPrice: '1000000000',
      gas: '50000',
      value: Web3.utils.toWei('4')
    })

    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(foreignWeb3, user.address)

    // The bridge should create a new transaction with a CollectedSignatures
    // event so we generate another trivial transaction
    await promiseRetry(
      async retry => {
        const lastBlockNumber = await foreignWeb3.eth.getBlockNumber()
        if (lastBlockNumber <= depositTx.blockNumber + 2) {
          await generateNewBlock(foreignWeb3, user.address)
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

    // check that account has tokens in the foreign chain
    await promiseRetry(async retry => {
      const balance = await token.methods.balanceOf(account1.address).call()
      console.log(`New balance: ${balance}`)
      if (toBN(balance).isZero()) {
        retry()
      }
    })
  })

  it('home (token) -> foreign (eth)', async () => {
    const originalBalance = await foreignWeb3.eth.getBalance(account1.address)

    // send tokens to foreign bridge
    await token.methods
      .transferAndCall(HOME_BRIDGE_ADDRESS, homeWeb3.utils.toWei('1'), '0x')
      .send({
        from: account1.address,
        gasPrice: '1000000000',
        gas: '1000000'
      })
      .catch(e => {
        console.error(e)
      })


    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(homeWeb3, user.address)
    await generateNewBlock(foreignWeb3, user.address)

    // check that balance increases
    await promiseRetry(async retry => {
      const balance = await foreignWeb3.eth.getBalance(account1.address)
      console.log(`original Balance: ${originalBalance}, new balance: ${balance}`)

      if (toBN(balance).lte(toBN(originalBalance))) {
        retry()
      }
    })
  })

  it('foreign (eth) -> home (token) with customized recipient', async () => {
    // check that account has zero tokens in the foreign chain
    const balance = await token.methods.balanceOf(account2.address).call()
    assert(toBN(balance).isZero(), 'Account should not have tokens yet')

    const value = Web3.utils.toWei('4')

    // foreign (account1) -> home (account2)
    let data = await token.methods.transfer(FOREIGN_BRIDGE_ADDRESS, value).encodeABI()
    data += '0'.repeat(12 * 2) + account2.address.slice(2)

    // account1 send one ether to home chain
    const depositTx = await foreignWeb3.eth.sendTransaction({
      from: account1.address,
      to: FOREIGN_BRIDGE_ADDRESS,
      gasPrice: '1000000000',
      gas: '50000',
      data,
      value
    })

    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(foreignWeb3, user.address)

    // The bridge should create a new transaction with a CollectedSignatures
    // event so we generate another trivial transaction
    await promiseRetry(
      async retry => {
        const lastBlockNumber = await foreignWeb3.eth.getBlockNumber()
        if (lastBlockNumber <= depositTx.blockNumber + 2) {
          await generateNewBlock(foreignWeb3, user.address)
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

    // check that account has tokens in the foreign chain
    await promiseRetry(async retry => {
      const balance = await token.methods.balanceOf(account2.address).call()
      console.log(`New balance: ${balance}`)
      if (toBN(balance).isZero()) {
        retry()
      }
    })
  })

  it('home (token) -> foreign (eth), with customized recipient', async () => {
    const originalBalance = await foreignWeb3.eth.getBalance(account1.address)
    const value = Web3.utils.toWei('0.5')

    // home (account2) -> foreign (account1)
    let data = await token.methods
      .transferAndCall(HOME_BRIDGE_ADDRESS, value, '0x')
      .encodeABI()
    data += '0'.repeat(12 * 2) + account1.address.slice(2)

    await homeWeb3.eth.sendTransaction({
      from: account2.address,
      to: deployed.homeBridge.erc677.address,
      gasPrice: '1000000000',
      gas: '5000000',
      data
    })

    // Send a trivial transaction to generate a new block since the watcher
    // is configured to wait 1 confirmation block
    await generateNewBlock(homeWeb3, user.address)
    await generateNewBlock(foreignWeb3, user.address)

    // check that balance increases
    await promiseRetry(async retry => {
      const balance = await foreignWeb3.eth.getBalance(account1.address)
      console.log(`original Balance: ${originalBalance}, new balance: ${balance}`)

      if (toBN(balance).lte(toBN(originalBalance))) {
        retry()
      }
    })
  })
})