const addr = '0x2E8a97c62Cc644aDCd108b9bEbCB9B32C9c58a1C'
const ForeignBridgeErcToErc = artifacts.require('ForeignBridgeErcToErc')
const maxPerTx = 100*1000000*1000000
const execMaxPerTx = 500*1000*1000000

module.exports = function (done) {
	(async () => {
		let h = await ForeignBridgeErcToErc.at(addr)
		await h.setDailyLimit(maxPerTx + 1)
		await h.setMaxPerTx(maxPerTx)
		await h.setExecutionDailyLimit(execMaxPerTx + 1)
		await h.setExecutionMaxPerTx(execMaxPerTx)
		done()
	})();
}
