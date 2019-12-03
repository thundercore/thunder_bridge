const addrUSDT = '0x2C66e58c123fe807ef9c36682257fA6bfB4AFA52'
const addrDAI = '0xa993c03b20e9582C3d7feaea8f61c383e258Cd48'
const HomeBridgeErcToErc = artifacts.require('HomeBridgeErcToErc')
const decimals = web3.utils.toBN(18)  // USDT: 6 , DAI: 18
const homeValue = web3.utils.toBN(500 * 1000)
const foreignValue = web3.utils.toBN(10 ** 8)
const maxPerTx = homeValue.mul(web3.utils.toBN(10).pow(decimals))
const execMaxPerTx = foreignValue.mul(web3.utils.toBN(10).pow(decimals))
const minPerTx = web3.utils.toBN(10).pow(decimals)

module.exports = function (done) {
        (async () => {
                let h = await HomeBridgeErcToErc.at(addrDAI)
                await h.setDailyLimit(maxPerTx.add(web3.utils.toBN(1)))
                await h.setMaxPerTx(maxPerTx)
                await h.setExecutionDailyLimit(execMaxPerTx.add(web3.utils.toBN(1)))
                await h.setExecutionMaxPerTx(execMaxPerTx)
                await h.setMinPerTx(minPerTx)
                done()
        })();
}
