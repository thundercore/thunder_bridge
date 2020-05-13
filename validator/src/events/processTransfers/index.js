require('dotenv').config()
const promiseLimit = require('promise-limit')
const { HttpListProviderError } = require('http-list-provider')
const bridgeValidatorsABI = require('../../../abis/BridgeValidators.abi')
const rootLogger = require('../../services/logger')
const { web3Home, web3Foreign } = require('../../services/web3')
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
const estimateGas = require('../processAffirmationRequests/estimateGas')

const limit = promiseLimit(MAX_CONCURRENT_EVENTS)

let validatorContract = null

function processTransfersBuilder(config, validator) {
  const homeBridge = new web3Home.eth.Contract(config.homeBridgeAbi, config.homeBridgeAddress)

  return async function processTransfers(transfers) {
    var txToSend = []

    if (validatorContract === null) {
      rootLogger.debug('Getting validator contract address')
      const validatorContractAddress = await homeBridge.methods.validatorContract().call()
      rootLogger.debug({ validatorContractAddress }, 'Validator contract address obtained')

      validatorContract = new web3Home.eth.Contract(bridgeValidatorsABI, validatorContractAddress)
    }

    rootLogger.debug(`Processing ${transfers.length} Transfer events`)
    const callbacks = transfers.map(transfer =>
      limit(async () => {
        // eslint-disable-next-line prefer-const
        let { from, value } = transfer.returnValues

        // override from field for hacked transfers (with additional 32 bytes data)
        const tx = await web3Foreign.eth.getTransaction(transfer.transactionHash)

        if (
          OBSERVABLE_METHODS.transfer.signature === tx.input.substring(0, 10) &&
          OBSERVABLE_METHODS.transfer.callDataLength === tx.input.length
        ) {
          const newFrom = `0x${tx.input.substring(
            (1 + 4 + 32 + 32) * 2 + 12 * 2, // 0x + sig + to + amount + zeros padding
            OBSERVABLE_METHODS.transfer.callDataLength
          )}`
          if (newFrom !== ZERO_ADDRESS) {
            from = newFrom
          }
        }

        const logger = rootLogger.child({
          eventTransactionHash: transfer.transactionHash
        })

        logger.info({ from, value }, `Processing transfer ${transfer.transactionHash}`)

        let gasEstimate
        try {
          logger.debug('Estimate gas')
          gasEstimate = await estimateGas({
            web3: web3Home,
            homeBridge,
            validatorContract,
            recipient: from,
            value,
            txHash: transfer.transactionHash,
            address: validator.address
          })
          logger.debug({ gasEstimate }, 'Gas estimated')
        } catch (e) {
          if (e instanceof HttpListProviderError) {
            throw new Error(
              'RPC Connection Error: submitSignature Gas Estimate cannot be obtained.'
            )
          } else if (e instanceof InvalidValidatorError) {
            logger.fatal({ address: validator.address }, 'Invalid validator')
            process.exit(EXIT_CODES.INCOMPATIBILITY)
          } else if (e instanceof AlreadySignedError) {
            logger.info(`Already signed transfer ${transfer.transactionHash}`)
            return
          } else if (e instanceof AlreadyProcessedError) {
            logger.info(
              `transfer ${transfer.transactionHash} was already processed by other validators`
            )
            return
          } else {
            logger.error(e, 'Unknown error while processing transaction')
            throw e
          }
        }

        const data = await homeBridge.methods
          .executeAffirmation(from, value, transfer.transactionHash)
          .encodeABI({ from: validator.address })

        logger.info({from, value, data}, "executeAffirmation.encodeABI")

        const t = {
          data,
          gasEstimate,
          transactionReference: transfer.transactionHash,
          to: config.homeBridgeAddress,
        }
        txToSend.push(t)
        logger.info({t}, "TxInfo")
      })
    )

    await Promise.all(callbacks)
    return txToSend
  }
}

module.exports = processTransfersBuilder
