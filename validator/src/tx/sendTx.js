const Web3Utils = require('web3-utils')

// eslint-disable-next-line consistent-return
async function sendRawTx({ web3, params, method }) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: '2.0',
        method,
        params,
        id: Math.floor(Math.random() * 100) + 1,
      },
      (err, result) => {
        if (err) {
          reject(err)
          return
        }
        if (result.error) {
          reject(result.error)
          return
        }
        resolve(result.result)
      },
    )
  })
}

// eslint-disable-next-line consistent-return
async function sendTx({ privateKey, data, nonce, gasPrice, amount, gasLimit, to, chainId, web3 }) {
  const serializedTx = await web3.eth.accounts.signTransaction(
    {
      nonce: Number(nonce),
      chainId,
      to,
      data,
      value: Web3Utils.toWei(amount),
      gasPrice,
      gas: gasLimit,
    },
    `0x${privateKey}`,
  )

  return sendRawTx({
    web3,
    method: 'eth_sendRawTransaction',
    params: [serializedTx.rawTransaction],
  })
}

module.exports = {
  sendTx,
  sendRawTx,
}
