const Web3Utils = require('web3-utils')

const env = require('./src/loadEnv')
const deployErcToErc = require('./deployErc')
const deployErc20 = require('./src/utils/deployERC20Token')

const { BRIDGE_MODE, ERC20_TOKEN_ADDRESS } = env

async function main() {
  let erc20Token = ERC20_TOKEN_ADDRESS
  if (BRIDGE_MODE === 'ERC_TO_ERC') {
    if (!ERC20_TOKEN_ADDRESS) {
      erc20Token = (await deployErc20()).erc677tokenAddress
      console.log(`deploy erc20: ${erc20Token}`)
    } else if (!Web3Utils.isAddress(ERC20_TOKEN_ADDRESS)) {
      throw new Error('Invalid erc20 token address')
    }
    console.log(`deploy ${BRIDGE_MODE} contract with erc20 token address: ${erc20Token}`)
    return deployErcToErc(erc20Token)
  }

  console.log(`deploy ${BRIDGE_MODE} contract`)
  return deployErcToErc(erc20Token)
}

main().catch(e => console.log('Error:', e))
