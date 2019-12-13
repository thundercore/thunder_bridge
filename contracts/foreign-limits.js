function toBN (amount) {
    return web3.toBigNumber(amount)
}
/* Thunder-mainnet / Ethereum */
const bridgeUSDT = '0x2E8a97c62Cc644aDCd108b9bEbCB9B32C9c58a1C'
const bridgeDAI = '0xf3Cab28E25b64fcd361446CCD6418D3e51d9cB52'
const bridgeTokenUSDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const bridgeTokenDAI = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'

/* Thunder-Venus / Kovan
const bridgeUSDT = '0x2eEeC8e67555846bbA37f28043Eb4f559C897Df2'
const bridgeDAI = '0x0555f6661D911f645E0ede6Ab88a7fFd5C89D514'
const bridgeTokenUSDT = '0x4B0b6E093a330c00fE614B804Ad59e9b0A4FE8A9'
const bridgeTokenDAI = '0xC746DA764aA4093EA1C3e9596F11fb5E04f8Acad'
*/
const ForeignBridgeErcToErc = artifacts.require('ForeignBridgeErcToErc')
const ERC677 = artifacts.require("ERC677BridgeToken.sol")

module.exports = function (done) {
        (async () => {
                let USDT_or_Not = false
                let Decimals = 0    // USDT: 6 , DAI: 18
                const token_usdt = await ERC677.at(bridgeTokenUSDT)
                const token_dai = await ERC677.at(bridgeTokenDAI)
                if (USDT_or_Not)
                    Decimals = toBN(await token_usdt.decimals())
                else
                    Decimals = toBN(await token_dai.decimals())

                const homeValue = toBN(500 * 1000)
                const foreignValue = toBN(10 ** 8)
                const maxPerTx = foreignValue.mul(toBN(10).pow(Decimals))
                const execMaxPerTx = homeValue.mul(toBN(10).pow(Decimals))
                const minPerTx = 0 * toBN(10).pow(Decimals)

                let h = await ForeignBridgeErcToErc.at(bridgeDAI)
                await h.setDailyLimit(maxPerTx.add(toBN(1)))
                await h.setMaxPerTx(maxPerTx)
                await h.setExecutionDailyLimit(execMaxPerTx.add(toBN(1)))
                await h.setExecutionMaxPerTx(execMaxPerTx)
                await h.setMinPerTx(minPerTx)
                done()
        })();
}
