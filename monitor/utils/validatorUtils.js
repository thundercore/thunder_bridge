/* eslint no-param-reassign: ["error", { "props": false }] */

const { BatchRequest } = require('./batch')
const { encodeEventAbi } = require("./contract")
const bridgeValidatorsAbi = require('../abis/BridgeValidators.abi')

const parseValidatorEvent = event => {
  if (
    event.event === undefined &&
    event.raw &&
    event.raw.topics &&
    (event.raw.topics[0] === '0xe366c1c0452ed8eec96861e9e54141ebff23c9ec89fe27b996b45f5ec3884987' ||
      event.raw.topics[0] === '0x8064a302796c89446a96d63470b5b036212da26bd2debe5bec73e0170a9a5e83')
  ) {
    const rawAddress = event.raw.topics.length > 1 ? event.raw.topics[1] : event.raw.data
    const address = '0x' + rawAddress.slice(26)
    event.event = 'ValidatorAdded'
    event.returnValues.validator = address
  } else if (
    event.event === undefined &&
    event.raw &&
    event.raw.topics &&
    event.raw.topics[0] === '0xe1434e25d6611e0db941968fdc97811c982ac1602e951637d206f5fdda9dd8f1'
  ) {
    const rawAddress = event.raw.data === '0x' ? event.raw.topics[1] : event.raw.data
    const address = '0x' + rawAddress.slice(26)
    event.event = 'ValidatorRemoved'
    event.returnValues.validator = address
  }
}

const processValidatorsEvents = events => {
  const validatorList = new Set()
  events.forEach(event => {
    parseValidatorEvent(event)

    if (event.event === 'ValidatorAdded') {
      validatorList.add(event.returnValues.validator)
    } else if (event.event === 'ValidatorRemoved') {
      validatorList.delete(event.returnValues.validator)
    }
  })

  return Array.from(validatorList)
}

const filterAsync = (array, filter) =>
  Promise.all(array.map(entry => filter(entry)))
    .then(bits => array.filter(entry => bits.shift()));

const getValidatorList = async (address, web3, fromBlock, toBlock) => {
  const validatorsContract = new web3.eth.Contract(bridgeValidatorsAbi, address)

  const event = validatorsContract.options.jsonInterface.find(e => e.type === 'event' && e.name === 'ValidatorAdded')

  const batch = new BatchRequest(web3)
  const logFilter = encodeEventAbi(web3, validatorsContract, event, fromBlock, toBlock)

  batch.add(web3.eth.getPastLogs.request(logFilter));

  let result;
  try {
    result = await batch.execute()
  } catch (e) {
    console.error(e)
    throw e
  }

  let [ logs ] = result

  logs = logs.map(e => web3.eth.abi.decodeLog(event.inputs, e.data, e.topics.slice(1)))

  validators = await filterAsync(logs, async e => 
    await validatorsContract.methods.isValidator(e.validator).call()
  );

  validators = validators.map(e => e.validator);

  return validators;
}

module.exports = {
  getValidatorList
}
