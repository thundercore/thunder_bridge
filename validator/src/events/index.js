const path = require('path')
const config = require(path.join('../../config/', process.argv[2]))

const processSignatureRequests = require('./processSignatureRequests')(config)
const processCollectedSignatures = require('./processCollectedSignatures')(config)
const processAffirmationRequests = require('./processAffirmationRequests')(config)
const processTransfers = require('./processTransfers')(config)


function processEvents(eventType, events) {
  switch (eventType) {
    case 'native-erc-signature-request':
    case 'erc-erc-signature-request':
    case 'erc-native-signature-request':
      return processSignatureRequests(events)
    case 'native-erc-collected-signatures':
    case 'erc-erc-collected-signatures':
    case 'erc-native-collected-signatures':
      return processCollectedSignatures(events)
    case 'native-erc-affirmation-request':
      return processAffirmationRequests(events)
    case 'erc-erc-affirmation-request':
    case 'erc-native-affirmation-request':
      return processTransfers(events)
    default:
      return []
  }
}


module.exports = {
    processEvents
}