const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')
const { deployContract, sendRawTxHome } = require('../deploymentUtils')

const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const {
  DEPLOYMENT_ACCOUNT_ADDRESS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_FEE_RECEIVER,
  HOME_WITHDRAW_FEE_PERCENT,
  HOME_WITHDRAW_FIXED_FEE,
  HOME_DEPOSIT_FEE_PERCENT,
  HOME_DEPOSIT_FIXED_FEE
} = env

const EternalStorageProxy = require('../../..//build/contracts/EternalStorageProxy.json')
const HomeBridgeWithFee = require('../../../build/contracts/HomeBridgeErcToErcWithFee.json')

async function deployHomeBridgeImpl(bridgeImpl, nonce, version) {
  console.log(`\ndeploying homeBridge v${version} implementation\n`)
  console.log(DEPLOYMENT_ACCOUNT_ADDRESS, DEPLOYMENT_ACCOUNT_PRIVATE_KEY)
  const homeBridgeImplementation = await deployContract(bridgeImpl, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  console.log(
    `[Home] HomeBridge ${version} Implementation: ${homeBridgeImplementation.options.address}`
  )
  return homeBridgeImplementation
}

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

async function upgradeHomeBridgeWithFee(homeBridgeAddress) {
  const version = '2'
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const homeBridgeWithFeeImpl = await deployHomeBridgeImpl(HomeBridgeWithFee, nonce, version)
  nonce++

  const homeBridgeStorage = new web3Home.eth.Contract(EternalStorageProxy.abi, homeBridgeAddress)
  await hookupHomeBridge(homeBridgeStorage, homeBridgeWithFeeImpl.options.address, version, nonce)
  nonce++

  homeBridgeWithFeeImpl.options.address = homeBridgeStorage.options.address

  await setupHomeBridge(
    homeBridgeAddress,
    homeBridgeWithFeeImpl.methods.setFeeReceiver,
    HOME_FEE_RECEIVER,
    nonce
  )
  nonce++

  if (HOME_WITHDRAW_FEE_PERCENT) {
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setWithdrawFeePercent,
      HOME_WITHDRAW_FEE_PERCENT,
      nonce
    )
    nonce++
  }
  if (HOME_WITHDRAW_FIXED_FEE) {
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setWithdrawFixedFee,
      HOME_WITHDRAW_FIXED_FEE,
      nonce
    )
    nonce++
  }
  if (HOME_DEPOSIT_FEE_PERCENT) {
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setDepositFeePercent,
      HOME_DEPOSIT_FEE_PERCENT,
      nonce
    )
    nonce++
  }
  if (HOME_DEPOSIT_FIXED_FEE) {
    await setupHomeBridge(
      homeBridgeAddress,
      homeBridgeWithFeeImpl.methods.setDepositFixedFee,
      HOME_DEPOSIT_FIXED_FEE,
      nonce
    )
    nonce++
  }

  console.log('\nUpgrade Home Bridge With Fee Finished\n')
}

module.exports = {
  upgradeHomeBridgeWithFee
}
