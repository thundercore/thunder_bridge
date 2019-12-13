function toBN (amount) {
    return web3.toBigNumber(amount)
}
/* Thunder-mainnet / Ethereum */
const bridgeUSDT = '0x2C66e58c123fe807ef9c36682257fA6bfB4AFA52'
const bridgeDAI = '0xa993c03b20e9582C3d7feaea8f61c383e258Cd48'
const bridgeTokenUSDT = '0x4f3C8E20942461e2c3Bdd8311AC57B0c222f2b82'
const bridgeTokenDAI = '0x2b31e3b88847f03c1335E99A0d1274A2c72059DE'

/* Thunder-Venus / Kovan
const bridgeUSDT = '0xBF848476876fe698f4a92C2AD025D75C6A4e9a18'
const bridgeDAI = '0x1eF34B08046CdC65f42C3199AD78d14ACafA4098'
const bridgeTokenUSDT = '0xB1Fb0b14Ffea209ABa1e62ff3F2F3DFD2eaa9FE0'
const bridgeTokenDAI = '0x29C4A36348eA74F004d80E99ceeED84566d80110'
*/
const HomeBridgeErcToErc = artifacts.require('HomeBridgeErcToErc')
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

		let h = await HomeBridgeErcToErc.at(bridgeDAI)

		await h.executeAffirmation('0xabCd8660a6F7c467a5A43ab9f3541462cc2eB850',
		    toBN(5).mul(toBN(10).pow(Decimals)),
			'ef0df538e7793680d16a39f86e71a865f2acea0318bdcfaf1d7f8b1aeefe94b3')
		done()
	})();
}
