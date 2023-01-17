require('dotenv').config()

const TokenProxy = require('../build/contracts/TokenProxy.json')
const MinterBurnerProxy = require('../build/contracts/MinterBurnerProxy.json')
const { deployContract, privateKeyToAddress } = require('./src/deploymentUtils')
const Web3 = require('web3')

const {
  HOME_TOKEN_ADDRESS,
  HOME_BRIDGE_ADDRESS,
  HOME_UPGRADEABLE_ADMIN,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_RPC_URL
} = process.env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL)
const web3Home = new Web3(homeProvider)

async function main() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  // deploy token wrapper impl
  let tokenWrapperImpl = await deployContract(MinterBurnerProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce
  })

  nonce++

  console.log(`deploy minter proxy implementation at: ${tokenWrapperImpl.options.address}`)

  let tokenWrapperInitializeData = tokenWrapperImpl.methods
    .initialize(HOME_TOKEN_ADDRESS, HOME_BRIDGE_ADDRESS)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })

  const tokenProxy = await deployContract(
    TokenProxy,
    [tokenWrapperImpl.options.address, HOME_UPGRADEABLE_ADMIN, tokenWrapperInitializeData],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'home', nonce }
  )

  console.log(`deploy minter proxy at: ${tokenProxy.options.address}`)
}

main().catch(e => console.log(e))
