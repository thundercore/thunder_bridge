const addrUSDT = '0x2E8a97c62Cc644aDCd108b9bEbCB9B32C9c58a1C'
const addrDAI = '0xf3Cab28E25b64fcd361446CCD6418D3e51d9cB52'
const ForeignBridgeErcToErc = artifacts.require('ForeignBridgeErcToErc')
const decimals = web3.utils.toBN(18)  // USDT: 6 , DAI: 18
const homeValue = web3.utils.toBN(500 * 1000)
const foreignValue = web3.utils.toBN(10 ** 8)
const maxPerTx = foreignValue.mul(web3.utils.toBN(10).pow(decimals))
const execMaxPerTx = homeValue.mul(web3.utils.toBN(10).pow(decimals))
const minPerTx = 0 * web3.utils.toBN(10).pow(decimals)

module.exports = function (done) {
        (async () => {
                let h = await ForeignBridgeErcToErc.at(addrDAI)
                await h.setDailyLimit(maxPerTx.add(web3.utils.toBN(1)))
                await h.setMaxPerTx(maxPerTx)
                await h.setExecutionDailyLimit(execMaxPerTx.add(web3.utils.toBN(1)))
                await h.setExecutionMaxPerTx(execMaxPerTx)
                await h.setMinPerTx(minPerTx)
                done()
        })();
}
