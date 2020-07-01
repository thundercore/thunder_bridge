const fs = require('fs')
const path = require('path')
const env = require('./src/loadEnv')

async function deployErcToErc(erc20TokenAddress) {
  const deployHome = require('./src/erc_to_erc/home')
  const deployForeign = require('./src/erc_to_erc/foreign')

  const { homeBridge, erc677 } = await deployHome()
  const { foreignBridge } = await deployForeign(erc20TokenAddress)
  console.log('\nDeployment has been completed.\n\n')
  console.log(
    `[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`
  )
  console.log(`[   Home  ] ERC677 Bridgeable Token: ${erc677.address}`)
  console.log(
    `[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${
      foreignBridge.deployedBlockNumber
    }`
  )
  console.log(`[ Foreign ] ERC20 Token: ${erc20TokenAddress}`)
  if (!fs.existsSync('data'))
    fs.mkdirSync('data', {recursive: true})
  fs.writeFileSync(
    'data/deployed.json',
    JSON.stringify(
      {
        homeBridge: {
          ...homeBridge,
          erc677
        },
        foreignBridge: {
          ...foreignBridge
        },
        erc20Token: {
          address: erc20TokenAddress
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `data/deployed.json`')
}

module.exports = deployErcToErc
