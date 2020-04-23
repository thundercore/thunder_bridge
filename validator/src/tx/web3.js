const logger = require('../services/logger').child({
  module: 'web3'
})
const { sendRawTx } = require('./sendTx')
const { BatchRequest } = require('./batch')
const { hexToNumber } = require('web3-utils')

async function getNonce(web3, address) {
  try {
    logger.debug({ address }, 'Getting transaction count')
    const transactionCount = await web3.eth.getTransactionCount(address)
    logger.debug({ address, transactionCount }, 'Transaction count obtained')
    return transactionCount
  } catch (e) {
    throw new Error(`Nonce cannot be obtained`)
  }
}

async function getBlockNumber(web3) {
  try {
    logger.debug('Getting block number')
    const blockNumber = await web3.eth.getBlockNumber()
    logger.debug({ blockNumber }, 'Block number obtained')
    return blockNumber
  } catch (e) {
    throw new Error(`Block Number cannot be obtained`)
  }
}

async function getChainId(chain) {
  try {
    logger.debug('Getting chain id')
    const chainIdHex = await sendRawTx({
      chain,
      method: 'net_version',
      params: []
    })
    const chainId = hexToNumber(chainIdHex)
    logger.debug({ chainId }, 'Chain id obtained')
    return chainId
  } catch (e) {
    throw new Error(`Chain Id cannot be obtained. Reason: ${e.message}`)
  }
}

async function getRequiredBlockConfirmations(contract) {
  try {
    const contractAddress = contract.options.address
    logger.debug({ contractAddress }, 'Getting required block confirmations')
    const requiredBlockConfirmations = await contract.methods.requiredBlockConfirmations().call()
    logger.debug(
      { contractAddress, requiredBlockConfirmations },
      'Required block confirmations obtained'
    )
    return requiredBlockConfirmations
  } catch (e) {
    throw new Error(`Required block confirmations cannot be obtained`)
  }
}

// `getEvents` uses JSON-RPC 2.0 batch requests to call getBlockNumber('latest') and getLogs(fromBlock, toBlock) in one
// request-response cycle. This ensures that the block number and logs are from the same RPC node.
// Since `eth_getLogs` does not return an error if `toBlock` is larger than largest block number known to the RPC node,
//   getBlockNumber('latest') being served by a node synced to block 100, then
//   getLogs(fromBlock: 99, toBlock: 100) being served by a node synced to block 99
// could make the caller miss the logs contained in block 100.
// The caller would think it has processed the logs in block 100 when it really has not.
async function getEvents({ web3, contract, eventName, fromBlock, toBlock, filter }) {
  logger.info({
      address: contract.options.address,
      event: eventName,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
  }, 'Getting past events');

  // find event named `eventName` from contract ABI
  const event = contract.options.jsonInterface.find(function(json) {
    return (json.type === 'event' && json.name === eventName);
  });
  if (!event) {
    throw new Error(`${eventName} not in the contract's ABI`)
  }

  const batch = new BatchRequest(web3)
  // `toBlock` from the caller should be the latest block minus `getRequiredBlockConfirmations()`
  batch.add(web3.eth.getBlockNumber.request())
  const logFilter = encodeEventAbi(web3, contract, event, fromBlock, toBlock, filter)
  batch.add(web3.eth.getPastLogs.request(logFilter))
  let results
  try {
    results = await batch.execute()
  } catch (e) {
    throw new Error(`${eventName} events cannot be obtained: ${e}`)
  }

  const [ latestBlock, logs ] = results
  const toBlockN = hexToNumber(toBlock)
  if (latestBlock < toBlockN) {
    throw new Error(`${eventName} event cannot be obtained: getEvents(fromBlock: ${hexToNumber(fromBlock)}, toBlock: ${toBlockN}) called when latest block reported by RPC node is ${latestBlock}`)
  }
  let events
  try {
    events = logs.map((log) => decodeEventAbi(web3, event, log))
  } catch (e) {
    throw new Error(`${eventName} events cannot be obtained, event decoding failed: ${e}`);
  }
  return events
}

function encodeEventAbi(web3, contract, event, fromBlock, toBlock, filter) {
  const params = {
    address: contract.options.address.toLowerCase(),
    fromBlock: web3.utils.toHex(fromBlock),
    toBlock: web3.utils.toHex(toBlock),
    topics: [event.signature],
  };

  let indexedTopics = event.inputs.filter(function(i) {
    return i.indexed === true
  }).map(function(i) {
    let value = filter[i.name]
    if (!value) {
      return null
    }
    return web3.eth.abi.encodeParameter(i.type, value)
  })

  params.topics = params.topics.concat(indexedTopics);
  return params;
}

function decodeEventAbi(web3, event, result) {
  let argTopics = result.topics.slice(1);
  result.returnValues = web3.eth.abi.decodeLog(event.inputs, result.data, argTopics);
  delete result.returnValues.__length__;
  result.event = event.name;
  result.signature = !result.topics[0] ? null: result.topics[0];
  result.raw = {
    data: result.data,
    topics: result.topics,
  };
  delete result.data;
  delete result.topics;
  return result;
}

module.exports = {
  getNonce,
  getBlockNumber,
  getChainId,
  getRequiredBlockConfirmations,
  getEvents
}
