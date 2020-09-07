const fs = require('fs')
const path = require('path')
const { upgradeHomeBridgeWithFee } = require('./src/erc_to_erc/upgradeHomeBridgeWithFee')

const deployedFile = fs.existsSync(process.argv[2])
  ? path.join(process.cwd(), process.argv[2])
  : `${process.cwd()}/data/deployed.json`

const deployed = require(deployedFile)

async function checkUpgrade(version, upgradeFunc, contractName) {
  if (!deployed.homeBridge.implemeation || Number(deployed.homeBridge.implemeation.version) < Number(version)) {
    console.log(`Upgrade home bridge v${version}: ${contractName}`)
    const address = await upgradeFunc(version, deployed.homeBridge.address)
    deployed.homeBridge.implemeation = {
      contractName,
      address,
      version
    }
    return
  }

  console.log(`Current implement version ${deployed.homeBridge.implemeation.vesrion} > version, skip ${upgradeFunc.name}`)
}

async function main() {
  console.log(`Home bridge address: ${deployed.homeBridge.address}`)
  await checkUpgrade('2', upgradeHomeBridgeWithFee, 'HomeBridgeErcToErcWithFee')

  fs.writeFileSync(deployedFile, JSON.stringify(deployed, null, 4))
}

main().catch(e => console.log('Error:', e))
