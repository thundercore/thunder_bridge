const addr = '0x2C66e58c123fe807ef9c36682257fA6bfB4AFA52'
const HomeBridgeErcToErc = artifacts.require('HomeBridgeErcToErc')

module.exports = function (done) {
	(async () => {
		let h = await HomeBridgeErcToErc.at(addr)
		await h.executeAffirmation('0x16ef0e12e33d5b11ade51549429100d04369e6a3',
			150*1000*1000000,
			'176525c08aa099ea9bd691f4fcf84f87e9617b428de6ccffd4431785ecf13a82')
		done()
	})();
}
