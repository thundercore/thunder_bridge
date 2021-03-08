/* eslint no-param-reassign: ["error", { "props": false }] */

const bridgeValidatorsAbi = require('../abis/BridgeValidators.abi')
const { getPastEvents } = require('./contract')

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

const getValidatorList = async (address, eth, fromBlock, toBlock) => {
  const validatorsContract = new eth.Contract(bridgeValidatorsAbi, address)
  let validators = (await validatorsContract.getPastEvents("ValidatorAdded", { fromBlock, toBlock })).map(e => e.returnValues.validator);

  validators = await filterAsync(validators, async v => await validatorsContract.methods.isValidator(v).call());

  return validators;
}

module.exports = {
  getValidatorList
}
