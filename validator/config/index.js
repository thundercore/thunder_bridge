require('dotenv').config()

const path = require('path')
const fs = require('fs')

function loadDeployedContract() {
  const deployedFile = path.join(__dirname, '../../data/deployed.json')
  if (fs.existsSync(deployedFile)) {
    const deployed = require(deployedFile)
    process.env.HOME_BRIDGE_ADDRESS = deployed.homeBridge.address
    process.env.FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
    process.env.ERC20_TOKEN_ADDRESS = deployed.erc20Token.address
  }
}

var configFile = path.join(__dirname, process.argv[2]? process.argv[2]: '')
if (process.env.NODE_ENV === "test" && !fs.existsSync(configFile)){
  configFile = path.join(__dirname, "test.config.js")
  loadDeployedContract()
}

if (process.env.LOAD_DEPLOYED_CONTRACT === "yes") {
  loadDeployedContract()
}

const config = require(configFile)
module.exports = config