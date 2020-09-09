
const { checkBalances, sleep } = require('./utils')

async function main() {
  while(true) {
    try {
      const status = await checkBalances()
      console.log(status)
    } catch (e) {
      console.log(e)
    } finally {
      await sleep(60 * 1000)
    }
  }
}


main()