require('dotenv').config()
const aws = require('aws-sdk')
const { privateKeyToAddress } = require('../src/utils/utils')

const { KEY_ID } = process.env

const kms = new aws.KMS()
const secretManager = new aws.SecretsManager({
  apiVersion: '2017-10-17',
})

let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (process.env.VALIDATOR_ADDRESS_PRIVATE_KEY) {
    return process.env.VALIDATOR_ADDRESS_PRIVATE_KEY
  }

  if (!REGION || !ACC_KEY_ID || !SECRET_ACC_KEY || !SECRET_ID) {
    throw new Error('AWS credentials are not specified')
  }

  if (cachedValidatorPrivateKey) {
    return cachedValidatorPrivateKey
  } else {
    const secret = await secretManager.getSecretValue({ SecretId: SECRET_ID }).promise()
    cachedValidatorPrivateKey = secret.SecretString
  }

  return cachedValidatorPrivateKey
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
    throw new Error('Failed to fetch validator address by private key')
  }
  return {
    id: validatorAddress.substring(0, 8),
    address: validatorAddress,
    privateKey: privateKey,
  }
}

module.exports = { getValidatorKey, loadValidatorFromAWS }
