const Web3 = require('web3')

var web3 = new Web3('https://testnet-rpc.thundercore.com/');
var deployed = require('../../data-testnet/deployed.json')
const ERC677_ABI = require('../abis/ERC677BridgeToken.abi')

const erc677Token = new web3.eth.Contract(
  ERC677_ABI,
  deployed.homeBridge.erc677.address
)

async function main() {
  const balance = await erc677Token.methods.balanceOf('0x9039dD6D7189CE1F9cF8b098d18358e4e41B19BD').call()
  console.log(balance)
}

main()