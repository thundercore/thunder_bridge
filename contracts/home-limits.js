const addr = '0x2C66e58c123fe807ef9c36682257fA6bfB4AFA52'
const HomeBridgeErcToErc = artifacts.require('HomeBridgeErcToErc')
const maxPerTx = 500 * 1000 * 1000000
const execMaxPerTx = 100 * 1000000 * 1000000

module.exports = function (done) {
	(async () => {
		let h = await HomeBridgeErcToErc.at(addr)
		await h.setDailyLimit(maxPerTx + 1)
		await h.setMaxPerTx(maxPerTx)
		await h.setExecutionDailyLimit(execMaxPerTx + 1)
		await h.setExecutionMaxPerTx(execMaxPerTx)
		done()
	})();
}
