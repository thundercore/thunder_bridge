const { BatchRequest } = require('./batch')

const { toBN } = require('web3').utils
const logger = require('pino')()

const ONE = toBN(1)
const TWO = toBN(2)
const queryRange = toBN(1000)

function encodeEventAbi(web3, contract, event, fromBlock, toBlock, filter = {}) {
  const params = {
    address: contract.options.address.toLowerCase(),
    fromBlock: web3.utils.toHex(fromBlock),
    toBlock: web3.utils.toHex(toBlock),
    topics: [event.signature],
  }

  const indexedTopics = event.inputs
  .filter(function (i) {
    return i.indexed === true
  })
  .map((i) => {
    const value = filter[i.name]
    if (!value) {
      return null
    }
    return this.web3.eth.abi.encodeParameter(i.type, value)
  })

  params.topics = params.topics.concat(indexedTopics)
  return params
}

function *getPastEventsIter({ web3, contract, event, fromBlock, toBlock, options, token }) {
  logger.debug(`${token} *getPastEventsIter: ${event} from: ${fromBlock} to: ${toBlock}`)
  let from = toBN(fromBlock)
  let to = toBN(fromBlock).add(queryRange)
  while (to.lt(toBlock)) {
    yield getPastEvents({web3, contract, event, fromBlock: from, toBlock: to, options, token})
    from = to.add(ONE)
    to = to.add(queryRange)
  }
  yield getPastEvents({web3, contract, event, fromBlock: from, toBlock, options, token})
}

async function getPastEvents({ web3, contract, event, fromBlock, toBlock, options, token }) {
  logger.debug(`${token} getPastEvents: ${event} from: ${fromBlock} to: ${toBlock}`)

  const eventJson = contract.options.jsonInterface.find(e => e.type === 'event' && e.name === event);
  const batch = new BatchRequest(web3)
  const logFilter = encodeEventAbi(web3, contract, eventJson, fromBlock, toBlock, options)

  batch.add(web3.eth.getPastLogs.request(logFilter))

  let events
  try {
    let [ logs ] = await batch.execute()
    events = logs.map(log => web3.eth.abi.decodeLog(eventJson.inputs, log.data, log.topics.slice(1)))
  } catch (e) {
    if (e.message && /query returned more than \d+ results/.test(e.message)) {
      const middle = fromBlock.add(toBlock).divRound(TWO)
      const middlePlusOne = middle.add(ONE)

      const firstHalfEvents = await getPastEvents({
        web3,
        contract,
        event,
        fromBlock,
        toBlock: middle,
        options
      })
      const secondHalfEvents = await getPastEvents({
        web3,
        contract,
        event,
        fromBlock: middlePlusOne,
        toBlock,
        options
      })
      events = [...firstHalfEvents, ...secondHalfEvents]
    } else {
      throw new Error(e)
    }
  }
  return events
}

const getBlockNumberCall = web3 => web3.eth.getBlockNumber()

async function getBlockNumber(web3Home, web3Foreign) {
  return (await Promise.all([web3Home, web3Foreign].map(getBlockNumberCall))).map(toBN)
}

module.exports = {
  getPastEvents,
  getPastEventsIter,
  getBlockNumber,
  encodeEventAbi
}
