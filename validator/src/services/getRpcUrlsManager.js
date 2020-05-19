require('dotenv').config()
const RpcUrlsManager = require('./RpcUrlsManager')

const envalid = require('envalid')

let validations = {
  HOME_RPC_URL: envalid.str(),
  FOREIGN_RPC_URL: envalid.str()
}

const env = envalid.cleanEnv(process.env, validations, {})

module.exports = new RpcUrlsManager(env.HOME_RPC_URL, env.FOREIGN_RPC_URL)