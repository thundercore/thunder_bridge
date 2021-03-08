if (process.env.NODE_ENV !== "production")
  require("dotenv").config();

const express = require('express');
const client = require('prom-client');
const fetch = require('node-fetch');
const HttpRetryProvider = require('./utils/httpRetryProvider')
const { newRedis } = require('./utils/redisClient')
const logger = require('pino')()
const Web3 = require('web3')
const { decodeBridgeMode } = require('./utils/bridgeMode')
const { initSentry } = require('./utils/sentry.js')
const Sentry = require('@sentry/node')

const { readFileSync, existsSync } = require('fs');
const { env } = process;

initSentry()

const _lock = {}

function isLocked(key) {
  return _lock[key] === true
}

function lock(key) {
  _lock[key] = true
}

function unlock(key) {
  _lock[key] = false
}

const JSONbig = require('json-bigint')({"storeAsString": true});
function mkDict(pairs) {
  const res = {}
  for (let i in pairs) {
    const p = pairs[i];
    res[p[0]] = p[1];
  }
  return res;
}

let config = existsSync("config.json") ? JSON.parse(readFileSync("config.json", "utf8")) :
  mkDict(env.TOKEN_LABELS.split(" ").filter(s => s.length >= 2).map(L => [L, {
    "HOME_RPC_URL": env.HOME_RPC_URL,
    "FOREIGN_RPC_URL": env.FOREIGN_RPC_URL,
    "TOKEN_PRICE_RPC_URL": env.TOKEN_PRICE_RPC_URL,
    "BRIDGE_MODE": env[`${L}_BRIDGE_MODE`],
    "HOME_BRIDGE_ADDRESS": env[`${L}_HOME_BRIDGE_ADDRESS`],
    "FOREIGN_BRIDGE_ADDRESS": env[`${L}_FOREIGN_BRIDGE_ADDRESS`],
    "HOME_DEPLOYMENT_BLOCK": env[`${L}_HOME_DEPLOYMENT_BLOCK`],
    "FOREIGN_DEPLOYMENT_BLOCK": env[`${L}_FOREIGN_DEPLOYMENT_BLOCK`],
    "UNISWAP_PAIR_ADDRESS": env[`${L}_UNISWAP_PAIR_ADDRESS`],
    "TOKEN_ADDRESS": env[`${L}_TOKEN_ADDRESS`],
    "STABLE_TOKEN_ADDRESS": env[`${L}_STABLE_TOKEN_ADDRESS`],
    "GAS_PRICE_SPEED_TYPE": env.GAS_PRICE_SPEED_TYPE,
    "GAS_LIMIT": env.GAS_LIMIT,
    "GAS_PRICE_FALLBACK": env.GAS_PRICE_FALLBACK,
    "UPDATE_PERIOD": parseInt(env.UPDATE_PERIOD),
    "HOME_MAX_GAS_PRICE_LIMIT": env.HOME_MAX_GAS_PRICE_LIMIT,
    "FOREIGN_MAX_GAS_PRICE_LIMIT": env.FOREIGN_MAX_GAS_PRICE_LIMIT,
  }]))


const redis = newRedis(config.REDIS_URL || process.env.REDIS_URL)
const registry = new client.Registry();
let exportStatus = {}


function mkDict(pairs) {
  const res = {}
  for (let i in pairs) {
    const p = pairs[i];
    res[p[0]] = p[1];
  }
  return res;
}

function hasDeepKeys(obj, keys) {
  let cur = obj;
  for (let i in keys) {
    if ((typeof (cur) !== "object") || !(keys[i] in cur)) return false;
    cur = cur[keys[i]];
  }
  return true;
}

function mkGaugedataRow(names, labelNames) {
  return mkDict(names.map(name => [name, { name: "bridge_" + name, help: name, labelNames }]))
}

const gauges = {}



const G_STATUSBRIDGES = mkGaugedataRow(
  ["totalSupply", "deposits", "depositValue", "depositUsers", "withdrawals", "withdrawalValue", "withdrawalUsers", "requiredSignatures"],
  ["network", "token"]
);
const G_STATUS = mkGaugedataRow(["balanceDiff", "balanceDiffAlignDecimal6", "decimals", "lastChecked", "requiredSignaturesMatch", "validatorsMatch", "price"], ["token"]);
const G_VALIDATORS = mkGaugedataRow(["balance", "leftTx", "gasPrice"], ["network", "token", "validator"]);


function updateRegistry(gaugeRow, name, tags, value, date) {
  const gd = gaugeRow[name];
  const g = (name in gauges) ? gauges[name] : (function () {
    const ng = new client.Gauge(gd);
    gauges[name] = ng;
    registry.registerMetric(ng);
    return ng;
  })();

  if (typeof (value) !== "undefined")
    g.set(mkDict(gd.labelNames.map(s => [s, tags[s]])), Number(value), date);
}



function updateAllData(data, token) {
  // calculating date once so that all metrics in this iteration have the exact same timestamp
  const date = new Date();

  for (let name in G_STATUS)
    if (name in data)
      updateRegistry(G_STATUS, name, { token }, data[name], date);

  ["home", "foreign"].forEach(network => {
    for (let name in G_STATUSBRIDGES)
      if (hasDeepKeys(data, [network, name]))
        updateRegistry(G_STATUSBRIDGES, name, { network, token }, data[network][name], date);

    for (let validator in data[network]["validators"])
      for (let name in G_VALIDATORS)
        if (hasDeepKeys(data, [network, "validators", validator, name]))
          updateRegistry(G_VALIDATORS, name, { network, token, validator }, data[network]["validators"][validator][name], date)
  });
}


async function checkStatus(token) {
  const context = config[token];
  context.redis = redis
  context.token = token

  const lockKey = `checkStatus_${token}`
  if(isLocked(lockKey)) {
    logger.info(`${lockKey} is locked. skip.`)
    return
  }
  lock(lockKey)

  try {
    const getBalances = require('./getBalances')(context)
    const getTokenPrice = require('./getTokenPrice')(context)
    const getShortEventStats = require('./getShortEventStats')(context)
    const bridgeMode = decodeBridgeMode(context.BRIDGE_MODE)
    const balances = await getBalances(bridgeMode)
    const events = await getShortEventStats(bridgeMode)
    const price = await getTokenPrice()
    const home = Object.assign({}, balances.home, events.home)
    const foreign = Object.assign({}, balances.foreign, events.foreign)
    const status = Object.assign({}, balances, price, events, { home }, { foreign })
    exportStatus[token]['status'] = status
    if (!status) throw new Error('status is empty: ' + JSON.stringify(status))
    updateAllData(status, token)
    return status
  } catch (e) {
    logger.error(e, 'failed to checkStatus')
    Sentry.captureException(e)
  } finally {
    unlock(lockKey)
  }
}


async function checkVBalances(token) {
  const context = config[token];

  const lockKey = `checkVBalances_${token}`
  if(isLocked(lockKey)) {
    logger.info(`${lockKey} is locked. skip.`)
    return
  }
  lock(lockKey)
  try {
    const { HOME_BRIDGE_ADDRESS, HOME_RPC_URL } = context;
    const homeProvider = new HttpRetryProvider(HOME_RPC_URL.split(","))
    const web3Home = new Web3(homeProvider)
    const HOME_ERC_TO_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')
    const validators = require('./validators')(context)
    const homeBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, HOME_BRIDGE_ADDRESS)
    const bridgeMode = decodeBridgeMode(config.BRIDGE_MODE)
    const vBalances = await validators(bridgeMode)
    exportStatus[token]['v_status'] = vBalances
    if (!vBalances) throw new Error('vBalances is empty: ' + JSON.stringify(vBalances))
    updateAllData(vBalances, token)
    return vBalances
  } catch (e) {
    logger.error(e, 'failed to checkVBalances')
    Sentry.captureException(e)
  } finally {
    unlock(lockKey)
  }
}

async function updateGasPrice() {
  const resp = await fetch(process.env.GAS_PRICE_ORACLE_URL || 'https://gasprice.poa.network/')
  const gasPrice = await resp.json()
  await redis.updateGasPrice(gasPrice)
}


for(let token in config) {
  if (!(token in exportStatus)) exportStatus[token] = {}
  const updater = ((token)=>()=>{checkStatus(token); checkVBalances(token)})(token);
  updater();
  setInterval(updater, config[token].UPDATE_PERIOD);
}

updateGasPrice()
setInterval(updateGasPrice, process.env.GAS_PRICE_INTERVAL || 60 * 1000)


function jsonResponse(res, json) {
  res.set('Content-Type', 'application/json');
  res.end(JSONbig.stringify(json))
}

function errorResponse(res, msg) {
  res.status(404).send(msg)
}

async function setGasPrice(req, res) {
  if (req.query.network === 'home' || req.query.network === 'foreign') {
    if (!req.query.value || isNaN(req.query.value)) {
      return errorResponse(res, 'Unknown value type')
    }
    const value = parseInt(req.query.value)
    await redis.setGasPrice(req.query.network, value)
  } else {
    return errorResponse(res, 'Unknown network type')
  }
  return jsonResponse(res, {message: `set ${req.query.network} gas price success, value: ${req.query.value}`})
}

async function getGasPrice(req, res) {
  if (req.query.network === 'home' || req.query.network === 'foreign') {
    return jsonResponse(res, await redis.getGasPrice(req.query.network))
  } else {
    return errorResponse(res, 'Unknown network type')
  }
}


const server = express();
server.get('/metrics', (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(registry.metrics());
});
server.get('/status', (req, res) => {
  res.set('Content-Type', 'application/json');
  res.end(JSONbig.stringify(exportStatus));
});
server.get('/gasPrice', getGasPrice)
server.post('/gasPrice', setGasPrice)

server.listen(3000);
