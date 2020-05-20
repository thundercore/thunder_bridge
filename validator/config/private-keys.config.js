require('dotenv').config()
const aws = require('aws-sdk')
const { privateKeyToAddress } = require('../src/utils/utils')

const s3 = new aws.S3()

const { KEY_BUCKET_NAME, KEY_PATH } = process.env
let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (process.env.NODE_ENV === "test" && process.env.VALIDATOR_ADDRESS_PRIVATE_KEY) {
    return process.env.VALIDATOR_ADDRESS_PRIVATE_KEY
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

async function loadValidatorFromAWS() {
  var privateKey = await getValidatorKey()
  if (!privateKey) {
    throw new Error('Failed to get validator private key from AWS')
  }

  const validatorAddress = privateKeyToAddress(privateKey)
  if (!validatorAddress) {
    throw new Error("Failed to fetch validator address by private key")
  }
  return {
    address: validatorAddress,
    privateKey: privateKey
  }
}

module.exports = { getValidatorKey, loadValidatorFromAWS }
