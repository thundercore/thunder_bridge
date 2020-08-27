const { upgradeHomeBridgeWithFee } = require('./src/erc_to_erc/upgradeHomeBridgeWithFee')

const deployed = require(`${process.cwd()}/data/deployed.json`)

async function main() {
  console.log(`Home bridge address: ${deployed.homeBridge.address}`)
  console.log(`Upgrade home bridge v2: HomeBridgeWithFee`)
  await upgradeHomeBridgeWithFee(deployed.homeBridge.address)
}

main().catch(e => console.log('Error:', e))
