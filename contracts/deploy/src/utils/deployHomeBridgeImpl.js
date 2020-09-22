const fs = require('fs')
const { deployContract, privateKeyToAddress } = require('../deploymentUtils')
const { web3Home } = require('../web3')
const env = require('../loadEnv')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHomeBridgeImpl(contractName) {
  const contract = require(`../../../build/contracts/${contractName}.json`)
  const nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log(`\ndeploying homeBridge ${contractName}\n`)
  console.log(DEPLOYMENT_ACCOUNT_ADDRESS, DEPLOYMENT_ACCOUNT_PRIVATE_KEY)
  const deployedContract = await deployContract(contract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  console.log(
    `[Home] ${contractName} implementation deployed: ${deployedContract.options.address}`
  )

  if (!fs.existsSync('data'))
    fs.mkdirSync('data', {recursive: true})

  fs.writeFileSync(`data/${contractName}.abi.json`, JSON.stringify(contract.abi, null, 4))
  return deployedContract
}

module.exports = {
    deployHomeBridgeImpl
}