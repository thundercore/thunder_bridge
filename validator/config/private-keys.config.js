require('dotenv').config()
const aws = require('aws-sdk')

const s3 = new aws.S3()

const { KEY_BUCKET_NAME, KEY_PATH, VALIDATOR_ADDRESS_PRIVATE_KEY} = process.env
let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (VALIDATOR_ADDRESS_PRIVATE_KEY) {
    return VALIDATOR_ADDRESS_PRIVATE_KEY
  }
  if (!KEY_BUCKET_NAME || !KEY_PATH) {
    throw new Error('Validator private key path is not specified')
  }
  if (cachedValidatorPrivateKey) {
    return cachedValidatorPrivateKey
  } else {
    const result = await s3
      .getObject({
        Bucket: KEY_BUCKET_NAME,
        Key: KEY_PATH
      })
      .promise()
    cachedValidatorPrivateKey = result.Body.toString()
    return cachedValidatorPrivateKey
  }
}

module.exports = { getValidatorKey }
