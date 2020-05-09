
// process.env.BRIDGE_MODE = "ERC_TO_ERC"
// process.env.QUEUE_URL = "amqp://rabbit"
// process.env.REDIS_URL = "redis://redis"
// process.env.HOME_RPC_URL = "http://parity1:8545"
// process.env.FOREIGN_RPC_URL = "http://parity2:8545"
// process.env.HOME_BRIDGE_ADDRESS = "0x1feB40aD9420b186F019A717c37f5546165d411E"
// process.env.FOREIGN_BRIDGE_ADDRESS = "0x4a58D6d8D416a5fBCAcf3dC52eb8bE8948E25127"
// process.env.ERC20_TOKEN_ADDRESS = "0x3C665A31199694Bf723fD08844AD290207B5797f"
// process.env.BRIDGEABLE_TOKEN_ADDRESS = "0x792455a6bCb62Ed4C4362D323E0590654CA4765c"
// process.env.VALIDATOR_ADDRESS = "0xaaB52d66283F7A1D5978bcFcB55721ACB467384b"
// process.env.VALIDATOR_ADDRESS_PRIVATE_KEY = "8e829f695aed89a154550f30262f1529582cc49dc30eff74a6b491359e0230f9"
// process.env.REDIS_LOCK_TTL = "1000"
// process.env.HOME_GAS_PRICE_ORACLE_URL = "https://gasprice.poa.network/"
// process.env.HOME_GAS_PRICE_SPEED_TYPE = "standard"
// process.env.HOME_GAS_PRICE_FALLBACK = "1000000000"
// process.env.HOME_GAS_PRICE_UPDATE_INTERVAL = "600000"
// process.env.FOREIGN_GAS_PRICE_ORACLE_URL = "https://gasprice.poa.network/"
// process.env.FOREIGN_GAS_PRICE_SPEED_TYPE = "standard"
// process.env.FOREIGN_GAS_PRICE_FALLBACK = "10000000000"
// process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL = "600000"
// process.env.HOME_POLLING_INTERVAL = "2000"
// process.env.FOREIGN_POLLING_INTERVAL = "2000"

require('dotenv').config({ path: __dirname + '/../.env' })
const deployed = require('../../data/deployed.json')

process.env.HOME_BRIDGE_ADDRESS = deployed.homeBridge.address
process.env.FOREIGN_BRIDGE_ADDRESS = deployed.foreignBridge.address
process.env.ERC20_TOKEN_ADDRESS = deployed.erc20Token.address


console.log(process.env)
const baseConfig = require('./base.config')
const { web3Home } = require('../src/services/web3')


module.exports = {
  ...baseConfig.bridgeConfig,
  initialize: baseConfig.initialize,
  queue: 'home',
  id: 'home',
  name: 'sender-home',
  web3: web3Home
}