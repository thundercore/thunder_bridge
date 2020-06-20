const { initSentry, checkBalances } = require('./utils')
const { sendFromForeignToHome } = require('./sendFromForeignToHome')
const { sendFromHomeToForeign } = require('./sendFromHomeToForeign')


async function main() {
  const start = new Date().toISOString()
  console.log(`[${start}] start to run crash test`)

  process.env.RETRY_LIMIT = 200

  while (true) {
    try {
      const before = await checkBalances()
      await Promise.all([
        sendFromForeignToHome(30),
        sendFromHomeToForeign(30)
      ])
      const after = await checkBalances()
      if (after.balanceDiff !== before.balanceDiff) {
        console.log(before, after, 'balanceDiff is not equal')
        process.exit(1)
      }
    } catch(e) {
      console.log(e, `run one round raise error`)
    }
  }
}

initSentry()
main()