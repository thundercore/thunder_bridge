const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const ERC677InitializableToken = require('../../../build/contracts/ERC677InitializableToken.json')
const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const TokenProxy = require('../../../build/contracts/TokenProxy.json')

let ForeignBridge
if (env.BRIDGE_MODE === 'NATIVE_TO_ERC') {
  console.log('Deploy ForeignBridgeWithNativeToken contract')
  ForeignBridge = require('../../../build/contracts/ForeignBridgeWithNativeToken.json')
} else if (env.BRIDGE_MODE === 'ERC_TO_ERC') {
  console.log('Deploy ForeignBridgeErcToErcV3 contract')
  ForeignBridge = require('../../../build/contracts/ForeignBridgeErcToErcV3.json')
} else if (env.BRIDGE_MODE === 'ERC_TO_NATIVE') {
  console.log('Deploy ForeignBridgeErc677ToNative contract')
  ForeignBridge = require('../../../build/contracts/ForeignBridgeERC677ToNative.json')
}

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_VALIDATORS_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  FOREIGN_GAS_PRICE,
  FOREIGN_MAX_AMOUNT_PER_TX,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  FOREIGN_FEE_PERCENT,
  BRIDGE_MODE,
  FOREIGN_FALLBACK_RECIPIENT
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployForeign(erc20TokenAddress) {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsForeign = await deployContract(BridgeValidators, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log(
    '[Foreign] BridgeValidators Implementation: ',
    bridgeValidatorsForeign.options.address
  )

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVForeignData = await storageValidatorsForeign.methods
    .upgradeTo('1', bridgeValidatorsForeign.options.address)
    .encodeABI({
      from: DEPLOYMENT_ACCOUNT_ADDRESS
    })
  const txUpgradeToBridgeVForeign = await sendRawTxForeign({
    data: upgradeToBridgeVForeignData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToBridgeVForeign.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\ninitializing Foreign Bridge Validators with following parameters:\n')
  console.log(
    `REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}`
  )
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  const initializeForeignData = await bridgeValidatorsForeign.methods
    .initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, FOREIGN_VALIDATORS_OWNER)
    .encodeABI({
      from: DEPLOYMENT_ACCOUNT_ADDRESS
    })
  const txInitializeForeign = await sendRawTxForeign({
    data: initializeForeignData,
    nonce: foreignNonce,
    to: bridgeValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeForeign.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nTransferring ownership of ValidatorsProxy\n')
  const validatorsForeignOwnershipData = await storageValidatorsForeign.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({
      from: DEPLOYMENT_ACCOUNT_ADDRESS
    })
  const txValidatorsForeignOwnershipData = await sendRawTxForeign({
    data: validatorsForeignOwnershipData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txValidatorsForeignOwnershipData.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log(
    '[Foreign] ForeignBridge Implementation: ',
    foreignBridgeImplementation.options.address
  )

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  const upgradeToForeignBridgeData = await foreignBridgeStorage.methods
    .upgradeTo('1', foreignBridgeImplementation.options.address)
    .encodeABI({
      from: DEPLOYMENT_ACCOUNT_ADDRESS
    })
  const txUpgradeToForeignBridge = await sendRawTxForeign({
    data: upgradeToForeignBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToForeignBridge.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  let initializableToken
  if (env.BRIDGE_MODE === 'ERC_TO_NATIVE') {
    console.log('\n[Foreign] deploying initializable token')
    initializableToken = await deployContract(
      ERC677InitializableToken,
      [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
      { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
    )
    foreignNonce++
    console.log('\n[Foreign] Initialize token')
    const initializableTokenData = await initializableToken.methods
      .initialize(
        BRIDGEABLE_TOKEN_NAME,
        BRIDGEABLE_TOKEN_SYMBOL,
        BRIDGEABLE_TOKEN_DECIMALS,
        DEPLOYMENT_ACCOUNT_ADDRESS
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const txInitializeToken = await sendRawTxForeign({
      data: initializableTokenData,
      nonce: foreignNonce,
      to: initializableToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeToken.status), 1, 'Transaction Failed')
    foreignNonce++

    console.log('\n[Foreign] deploy token proxy')
    const tokenProxy = await deployContract(
      TokenProxy,
      [initializableToken.options.address, FOREIGN_UPGRADEABLE_ADMIN, initializableTokenData],
      { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
    )
    initializableToken.options.address = tokenProxy.options.address
    foreignNonce++
    console.log('[Foreign] Bridgeble Token: ', tokenProxy.options.address)

    console.log('\nset bridge contract on ERC677BridgeToken')
    const setBridgeContractData = await initializableToken.methods
      .setBridgeContract(foreignBridgeStorage.options.address)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const setBridgeContract = await sendRawTxForeign({
      data: setBridgeContractData,
      nonce: foreignNonce,
      to: initializableToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(Web3Utils.hexToNumber(setBridgeContract.status), 1, 'Transaction Failed')
    foreignNonce++

    console.log('transferring ownership of Bridgeble token to homeBridge contract')
    const txOwnershipData = await initializableToken.methods
      .transferOwnership(foreignBridgeStorage.options.address)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const txOwnership = await sendRawTxForeign({
      data: txOwnershipData,
      nonce: foreignNonce,
      to: initializableToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(Web3Utils.hexToNumber(txOwnership.status), 1, 'Transaction Failed')
    foreignNonce++
  }
  console.log('\ninitializing Foreign Bridge with following parameters:\n')
  console.log(`Foreign Validators: ${storageValidatorsForeign.options.address},
  `)
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address

  let initializeFBridgeData
  if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
    initializeFBridgeData = await foreignBridgeImplementation.methods
      .initialize(
        storageValidatorsForeign.options.address,
        foreignBridgeStorage.options.address,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        FOREIGN_GAS_PRICE,
        FOREIGN_MAX_AMOUNT_PER_TX,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        FOREIGN_BRIDGE_OWNER,
        FOREIGN_FEE_PERCENT,
        FOREIGN_FALLBACK_RECIPIENT
      )
      .encodeABI({
        from: DEPLOYMENT_ACCOUNT_ADDRESS
      })
  } else if (BRIDGE_MODE === 'ERC_TO_ERC') {
    initializeFBridgeData = await foreignBridgeImplementation.methods
      .initialize(
        storageValidatorsForeign.options.address,
        erc20TokenAddress,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        FOREIGN_GAS_PRICE,
        FOREIGN_MAX_AMOUNT_PER_TX,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        FOREIGN_BRIDGE_OWNER,
        FOREIGN_FEE_PERCENT,
        FOREIGN_FALLBACK_RECIPIENT
      )
      .encodeABI({
        from: DEPLOYMENT_ACCOUNT_ADDRESS
      })
  } else { // ERC_TO_NATIVE
    initializeFBridgeData = await foreignBridgeImplementation.methods
      .initialize(
        storageValidatorsForeign.options.address,
        initializableToken.options.address,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        FOREIGN_GAS_PRICE,
        FOREIGN_MAX_AMOUNT_PER_TX,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        FOREIGN_BRIDGE_OWNER,
        FOREIGN_FEE_PERCENT
      )
      .encodeABI({
        from: DEPLOYMENT_ACCOUNT_ADDRESS
      })
  }

  const txInitializeBridge = await sendRawTxForeign({
    data: initializeFBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeBridge.status), 1, 'Transaction Failed')
  foreignNonce++

  const bridgeOwnershipData = await foreignBridgeStorage.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({
      from: DEPLOYMENT_ACCOUNT_ADDRESS
    })
  const txBridgeOwnershipData = await sendRawTxForeign({
    data: bridgeOwnershipData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txBridgeOwnershipData.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nForeign Deployment Bridge completed\n')
  const ercTokenAddress = {
    ERC_TO_NATIVE: initializableToken ? initializableToken.options.address : undefined,
    NATIVE_TO_ERC: foreignBridgeStorage.options.address,
    ERC_TO_ERC: erc20TokenAddress
  }

  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(foreignBridgeStorage.deployedBlockNumber)
    },
    erc20Token: {
      address: ercTokenAddress[BRIDGE_MODE]
    }
  }
}

module.exports = deployForeign
