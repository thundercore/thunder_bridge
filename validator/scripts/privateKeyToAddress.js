const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const privateKey = require('../config/private-keys.config')

async function main() {
  const validator = await privateKey.loadValidatorFromAWS()
}

main()
