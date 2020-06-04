const env = require('./src/loadEnv')
const deployErcToErc = require('./deployErc')
const deployErc20 = require('./src/utils/deployERC20Token')

let { ERC20_TOKEN_ADDRESS } = env


async function main() {
  if (!ERC20_TOKEN_ADDRESS) {
    ERC20_TOKEN_ADDRESS = (await deployErc20()).erc677tokenAddress
    console.log(`deploy erc20: ${ERC20_TOKEN_ADDRESS}`)
  }
  console.log(`deploy erc_to_erc contract with erc20 token address: ${ERC20_TOKEN_ADDRESS}`)
  await deployErcToErc(ERC20_TOKEN_ADDRESS)
}

main().catch(e => console.log('Error:', e))
