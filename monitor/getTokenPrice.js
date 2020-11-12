const BN = require('bignumber.js')
const Web3 = require('web3')
const HttpRetryProvider = require('./utils/httpRetryProvider')
const ERC20_ABI = require('./abis/ERC20.abi')
const ten = new BN(10)
const logger = require('pino')()


async function makeBatchRequest(web3, calls) {
  let batch = new web3.BatchRequest();

  let promises = calls.map(call => {
      return new Promise((res, rej) => {
          let req = call.request({}, (err, data) => {
              if(err) rej(err);
              else res(data)
          });
          batch.add(req)
      })
  })
  batch.execute()

  return Promise.all(promises)

}

async function getTokenPrice(web3, swapPairAddress, tokenAddress, stableTokenAddress) {
  const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress)
  const stableCoinContract = new web3.eth.Contract(ERC20_ABI, stableTokenAddress)

  const calls = [
    tokenContract.methods.decimals().call,
    tokenContract.methods.balanceOf(swapPairAddress).call,
    stableCoinContract.methods.decimals().call,
    stableCoinContract.methods.balanceOf(swapPairAddress).call,
  ]
  const [
    tokenDecimals,
    tokenBalance,
    stableTokenDecimals,
    stableCoinBalance
  ] = await makeBatchRequest(web3, calls)

  const price = new BN(stableCoinBalance)
    .multipliedBy(ten.pow(Number(tokenDecimals)))
    .idiv(new BN(tokenBalance)).idiv(ten.pow(Number(stableTokenDecimals-6)))

  return price.toString()
}

function main({ TOKEN_PRICE_RPC_URL, UNISWAP_PAIR_ADDRESS, TOKEN_ADDRESS, STABLE_TOKEN_ADDRESS }) {
  if (!UNISWAP_PAIR_ADDRESS)
    return async () => {}

  return async function main() {
    const foreignProvider = new HttpRetryProvider(TOKEN_PRICE_RPC_URL.split(","))
    const web3Foreign = new Web3(foreignProvider)

    const price = await getTokenPrice(
      web3Foreign,
      UNISWAP_PAIR_ADDRESS,
      TOKEN_ADDRESS,
      STABLE_TOKEN_ADDRESS,
    )

    logger.debug({price, pair: UNISWAP_PAIR_ADDRESS, token: TOKEN_ADDRESS}, 'getTokenPrice')

    return {price}
  }
}

module.exports = main