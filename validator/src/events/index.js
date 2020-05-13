const config = require('../../config')

const processSignatureRequestsBuilder = require('./processSignatureRequests')
const processCollectedSignaturesBuilder = require('./processCollectedSignatures')
const processAffirmationRequestsBuilder = require('./processAffirmationRequests')
const processTransfersBuilder = require('./processTransfers')


async function processEvents(task, validator) {
  const events = [task.event]

  var builder;
  switch (task.eventType) {
    case 'native-erc-signature-request':
    case 'erc-erc-signature-request':
    case 'erc-native-signature-request':
      builder = processSignatureRequestsBuilder
      break

    case 'native-erc-collected-signatures':
    case 'erc-erc-collected-signatures':
    case 'erc-native-collected-signatures':
      builder = processCollectedSignaturesBuilder
      break

    case 'native-erc-affirmation-request':
      builder = processAffirmationRequestsBuilder
      break

    case 'erc-erc-affirmation-request':
    case 'erc-native-affirmation-request':
      builder = processTransfersBuilder
      break

    default:
      throw Error(`event type ${task.eventType} is not subscribed`)
  }

  return builder(config, validator)(events)
}


module.exports = {
    processEvents
}