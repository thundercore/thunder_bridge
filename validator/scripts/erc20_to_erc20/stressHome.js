const { initSentry, checkBalances } = require('./utils')
const { sendFromHomeToForeign } = require('./sendFromHomeToForeign')

const numberToSend = process.argv[2]

async function main() {
  const start = new Date().toISOString()
  console.log(`[${start}] start to test home -> foreign`)

  let sent, success = 0
  while(true) {
    try {
      const before = await checkBalances()
      const { done, numberToCheck } = await sendFromHomeToForeign(numberToSend)
      sent += numberToCheck
      success += done
      const end = await checkBalances()
      console.log(before, end)
    } catch (e) {
      console.log(e, 'stress test raise error')
      await new Promise(r => setTimeout(r, 10 * 1000))
    } finally{
      const now = new Date().toISOString()
      console.log(`[${now}] sent: ${sent}, success: ${success}`)
    }
  }
}

initSentry()
main()