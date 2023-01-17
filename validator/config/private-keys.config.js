require('dotenv').config()
const aws = require('aws-sdk')
const { privateKeyToAddress } = require('../src/utils/utils')

const s3 = new aws.S3()
const kms = new aws.KMS()

const { KEY_BUCKET_NAME, KEY_PATH, KEY_ID } = process.env
let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (process.env.VALIDATOR_ADDRESS_PRIVATE_KEY) {
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
    cachedValidatorPrivateKey = result.Body.toString().trim()
    return cachedValidatorPrivateKey
  }
}

async function loadValidatorFromAWS() {
  var encrypedPrivateKey = await getValidatorKey()
  if (!encrypedPrivateKey) {
    throw new Error('Failed to get validator private key from AWS')
  }

  const decryptedParam = {
    CiphertextBlob: Buffer.from(encrypedPrivateKey, 'base64'),
    KeyId: KEY_ID,
  }

  const res = await kms.decrypt(decryptedParam).promise()
  const privateKey = res.Plaintext.toString('utf-8')

  if (!privateKey) {
    throw new Error('Failed to decrypt validator private key')
  }

  const validatorAddress = privateKeyToAddress(privateKey)
  if (!validatorAddress) {
    throw new Error("Failed to fetch validator address by private key")
  }
  return {
    id: validatorAddress.substring(0, 8),
    address: validatorAddress,
    privateKey: privateKey,
  }
}

module.exports = { getValidatorKey, loadValidatorFromAWS }
