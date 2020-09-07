const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')
const { sendRawTxHome } = require('../deploymentUtils')
const { deployHomeBridgeImpl } = require('../utils/deployHomeBridgeImpl')

const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const {
  DEPLOYMENT_ACCOUNT_ADDRESS,
  HOME_FEE_RECEIVER,
  HOME_WITHDRAW_FEE_PERCENT,
  HOME_WITHDRAW_FIXED_FEE,
  HOME_DEPOSIT_FEE_PERCENT,
  HOME_DEPOSIT_FIXED_FEE,
} = env

const EternalStorageProxy = require('../../..//build/contracts/EternalStorageProxy.json')


async function hookupHomeBridge(storageProxy, homeBridgeAddress, version, nonce) {
  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const upgradeToHomeBridgeData = await storageProxy.methods
    .upgradeTo(version, homeBridgeAddress)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })

  const txHookup = await sendRawTxHome({
    data: upgradeToHomeBridgeData,
    nonce,
    to: storageProxy.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txHookup.status), 1, 'Transaction Failed')
}

async function setupHomeBridge(homeBridgeAddress, func, value, nonce) {
  const data = func(value).encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const tx = await sendRawTxHome({
    data,
    nonce,
    to: homeBridgeAddress,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(tx.status), 1, 'Transaction Failed')
}

async function setupHomeBridgeWithFee(homeBridgeAddress, homeBridgeWithFeeImpl) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log(`Set fee receiver: ${HOME_FEE_RECEIVER}`)
  await setupHomeBridge(
    homeBridgeAddress,
    homeBridgeWithFeeImpl.methods.setFeeReceiver,
    HOME_FEE_RECEIVER,
    nonce
  )
  nonce++

  if (HOME_WITHDRAW_FEE_PERCENT) {
    console.log(`Set home withdraw percent fee: ${HOME_WITHDRAW_FEE_PERCENT}`)
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setWithdrawFeePercent,
      HOME_WITHDRAW_FEE_PERCENT,
      nonce
    )
    nonce++
  }
  if (HOME_WITHDRAW_FIXED_FEE) {
    console.log(`Set home withdraw fixed fee: ${HOME_WITHDRAW_FIXED_FEE}`)
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setWithdrawFixedFee,
      HOME_WITHDRAW_FIXED_FEE,
      nonce
    )
    nonce++
  }
  if (HOME_DEPOSIT_FEE_PERCENT) {
    console.log(`Set home deposit percent fee: ${HOME_DEPOSIT_FEE_PERCENT}`)
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setDepositFeePercent,
      HOME_DEPOSIT_FEE_PERCENT,
      nonce
    )
    nonce++
  }
  if (HOME_DEPOSIT_FIXED_FEE) {
    console.log(`Set home deposit fixed fee: ${HOME_DEPOSIT_FIXED_FEE}`)
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setDepositFixedFee,
      HOME_DEPOSIT_FIXED_FEE,
      nonce
    )
    nonce++
  }
}

async function upgradeHomeBridgeWithFee(version, homeBridgeAddress) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  const homeBridgeWithFeeImpl = await deployHomeBridgeImpl('HomeBridgeErcToErcWithFee')
  nonce++

  const homeBridgeStorage = new web3Home.eth.Contract(EternalStorageProxy.abi, homeBridgeAddress)
  await hookupHomeBridge(homeBridgeStorage, homeBridgeWithFeeImpl.options.address, version, nonce)
  nonce++

  homeBridgeWithFeeImpl.options.address = homeBridgeAddress

  await setupHomeBridgeWithFee(homeBridgeAddress, homeBridgeWithFeeImpl)

  console.log('\nUpgrade Home Bridge With Fee Finished\n')
  return homeBridgeWithFeeImpl.options.address
}

module.exports = {
  upgradeHomeBridgeWithFee,
  hookupHomeBridge,
  deployHomeBridgeImpl,
  setupHomeBridgeWithFee
}
