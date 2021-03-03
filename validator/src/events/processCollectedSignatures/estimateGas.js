const Web3 = require('web3')
const { HttpListProviderError } = require('http-list-provider')
const {
  AlreadyProcessedError,
  IncompatibleContractError,
  InvalidValidatorError
} = require('../../utils/errors')
const { parseMessage } = require('../../utils/message')
const logger = require('../../services/logger').child({
  module: 'processCollectedSignatures:estimateGas'
})

const web3 = new Web3()
const { toBN } = Web3.utils

async function estimateGas({
  validatorAddress,
  foreignBridge,
  validatorContract,
  message,
  numberOfCollectedSignatures,
  v,
  r,
  s
}) {
  try {
    const gasEstimate = await foreignBridge.methods
      .executeSignatures(v, r, s, message)
      .estimateGas({from: validatorAddress})
    return gasEstimate
  } catch (e) {
    if (e instanceof HttpListProviderError) {
      throw e
    }

    // check if the message was already processed
    logger.debug('Check if the message was already processed')
    const { txHash } = parseMessage(message)
    const alreadyProcessed = await foreignBridge.methods.relayedMessages(txHash).call({ from: validatorAddress })
    if (alreadyProcessed) {
      throw new AlreadyProcessedError()
    }

    // check if the number of signatures is enough
    logger.debug('Check if number of signatures is enough')
    const requiredSignatures = await validatorContract.methods.requiredSignatures().call({from: validatorAddress})
    if (toBN(requiredSignatures).gt(toBN(numberOfCollectedSignatures))) {
      throw new IncompatibleContractError('The number of collected signatures does not match')
    }

    // check if all the signatures were made by validators
    for (let i = 0; i < v.length; i++) {
      const address = web3.eth.accounts.recover(message, web3.utils.toHex(v[i]), r[i], s[i])
      logger.debug({ address }, 'Check that signature is from a validator')
      const isValidator = await validatorContract.methods.isValidator(address).call({from: address})

      if (!isValidator) {
        throw new InvalidValidatorError(`Message signed by ${address} that is not a validator`)
      }
    }

    throw new Error(`Unknown error while processing message: ${e.message}`)
  }
}

module.exports = estimateGas
