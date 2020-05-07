const env = require('./src/loadEnv')
const deployErcToErc = require('./deployErc')

const { BRIDGE_MODE } = env


async function main() {
  console.log(`Bridge mode: ${BRIDGE_MODE}`)
  switch (BRIDGE_MODE) {
    case 'ERC_TO_ERC':
      await deployErcToErc()
      break
    default:
      console.log(BRIDGE_MODE)
      throw new Error('Please specify BRIDGE_MODE: ERC_TO_ERC')
  }
}

main().catch(e => console.log('Error:', e))
