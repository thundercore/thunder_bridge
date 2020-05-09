require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
const { createMessage } = require('../../utils/message')
const estimateGas = require('./estimateGas')
const privateKey = require('../../../config/private-keys.config')
const {
  AlreadyProcessedError,
  AlreadySignedError,
  InvalidValidatorError
} = require('../../utils/errors')
const {
  EXIT_CODES,
  MAX_CONCURRENT_EVENTS,
  OBSERVABLE_METHODS,
  ZERO_ADDRESS
} = require('../../utils/constants')

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let expectedMessageLength = null
let validatorContract = null

function processSignatureRequestsBuilder(config) {
  const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, config.homeBridgeAddress)

  return async function processSignatureRequests(signatureRequests) {
    const txToSend = []

    if (expectedMessageLength === null) {
      expectedMessageLength = await homeBridge.methods.requiredMessageLength().call()
    }

    if (validatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const validatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')

      validatorContract = new web3Home.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
    }

    rootLogger.debug(`Processing ${signatureRequests.length} SignatureRequest events`)
    const callbacks = signatureRequests.map(signatureRequest =>
      limit(async () => {
        // eslint-disable-next-line prefer-const
        let { recipient, value } = signatureRequest.returnValues

        // override from field for hacked transfers (with additional 32 bytes data)
        const tx = await web3Home.eth.getTransaction(signatureRequest.transactionHash)

        if (
          OBSERVABLE_METHODS.transferAndCall.signature === tx.input.substring(0, 10) &&
          OBSERVABLE_METHODS.transferAndCall.callDataLength === tx.input.length
        ) {
          const newRecipient = `0x${tx.input.substring(
            (1 + 4 + 32 + 32 + 32 + 32) * 2 + 12 * 2, // 0x + sig + to + amount + dataLength + data + zeros padding
            OBSERVABLE_METHODS.transferAndCall.callDataLength
          )}`
          if (newRecipient !== ZERO_ADDRESS) {
            recipient = newRecipient
          }
        }

        const logger = rootLogger.child({
          eventTransactionHash: signatureRequest.transactionHash
        })

        logger.info(
          { sender: recipient, value },
          `Processing signatureRequest ${signatureRequest.transactionHash}`
        )

        const message = createMessage({
          recipient,
          value,
          transactionHash: signatureRequest.transactionHash,
          bridgeAddress: config.foreignBridgeAddress,
          expectedMessageLength
        })
        const pk = await privateKey.getValidatorKey()
        const signature = web3Home.eth.accounts.sign(message, `0x${pk}`)

        let gasEstimate
        try {
          logger.debug('Estimate gas')
          gasEstimate = await estimateGas({
            web3: web3Home,
            homeBridge,
            validatorContract,
            signature: signature.signature,
            message,
            address: config.validatorAddress
          })
          logger.debug({ gasEstimate }, 'Gas estimated')
        } catch (e) {
          if (e instanceof HttpListProviderError) {
            throw new Error(
              'RPC Connection Error: submitSignature Gas Estimate cannot be obtained.'
            )
          } else if (e instanceof InvalidValidatorError) {
            logger.fatal({ address: config.validatorAddress }, 'Invalid validator')
            process.exit(EXIT_CODES.INCOMPATIBILITY)
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed signatureRequest ${signatureRequest.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `signatureRequest ${
                signatureRequest.transactionHash
              } was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const data = await homeBridge.methods
          .submitSignature(signature.signature, message)
          .encodeABI({ from: config.validatorAddress })

        txToSend.push({
          data,
          gasEstimate,
          transactionReference: signatureRequest.transactionHash,
          to: config.homeBridgeAddress,
        })
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processSignatureRequestsBuilder
