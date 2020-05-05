const logger = require('../services/logger').default.child({
  module: 'web3'
})
const { sendRawTx } = require('./sendTx')
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

module.exports = {
  getNonce,
  getBlockNumber,
  getChainId,
}
