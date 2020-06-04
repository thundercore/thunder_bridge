const Web3 = require('web3')

var web3 = new Web3('https://testnet-rpc.thundercore.com/');
var deployed = require('../../data-testnet/deployed.json')
var erc20Abi = require('../abis/ERC20.abi.json')


async function main() {
  web3.eth.accounts.wallet.add('0x2c3b2a410d5153214e97c814a300f8e7beb31485d0843f5b28826bab1918a61f')
  let erc20 = new web3.eth.Contract(erc20Abi, deployed.erc20Token.address)
  console.log(erc20.address)
  const r = await erc20.methods
  .transfer(deployed.foreignBridge.address, web3.utils.toWei('0.01'))
  .send({from: '0x9039dD6D7189CE1F9cF8b098d18358e4e41B19BD', gas: 100000})
  console.log(r)
}

main()