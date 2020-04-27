require('dotenv').config()
const path = require('path')
const { connectSenderToQueue } = require('./services/amqpClient')
const { redis, redlock } = require('./services/redisClient')
const GasPrice = require('./services/gasPrice')
const logger = require('./services/logger')
const rpcUrlsManager = require('./services/getRpcUrlsManager')
const { sendTx } = require('./tx/sendTx')
const { getNonce, getChainId } = require('./tx/web3')
const privateKey = require('../config/private-keys.config')
const {
  addExtraGas,
  checkHTTPS,
  privateKeyToAddress,
  syncForEach,
  waitForFunds,
  watchdog
} = require('./utils/utils')
const { EXIT_CODES, EXTRA_GAS_PERCENTAGE } = require('./utils/constants')

const { REDIS_LOCK_TTL } = process.env

async function run({channel, web3}){
    

}

function main({env}) {
    web3 = Web3()
    
    await run(channel, web3)
}

main(process.env)