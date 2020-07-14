const { toBN } = require('web3').utils

const ONE = toBN(1)
const TWO = toBN(2)
const queryRange = toBN(1000)

function *getPastEventsIter({ contract, event, fromBlock, toBlock, options, token }) {
  console.log(`${token} *getPastEventsIter: ${event} from: ${fromBlock} to: ${toBlock}`)
  let from = toBN(fromBlock)
  let to = toBN(fromBlock).add(queryRange)
  while (to.lt(toBlock)) {
    yield getPastEvents({contract, event, fromBlock: from, toBlock: to, options, token})
    from = to.add(ONE)
    to = to.add(queryRange)
  }
  yield getPastEvents({contract, event, fromBlock: from, toBlock, options, token})
}

async function getPastEvents({ contract, event, fromBlock, toBlock, options, token }) {
  console.log(`${token} getPastEvents: ${event} from: ${fromBlock} to: ${toBlock}`)
  let events
  try {
    events = await contract.getPastEvents(event, {
      ...options,
      fromBlock,
      toBlock
    })
  } catch (e) {
    if (e.message && /query returned more than \d+ results/.test(e.message)) {
      const middle = fromBlock.add(toBlock).divRound(TWO)
      const middlePlusOne = middle.add(ONE)

      const firstHalfEvents = await getPastEvents({
        contract,
        event,
        fromBlock,
        toBlock: middle,
        options
      })
      const secondHalfEvents = await getPastEvents({
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
  getBlockNumber
}
