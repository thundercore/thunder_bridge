require('dotenv').config()
const aws = require('aws-sdk')
const { privateKeyToAddress } = require('../src/utils/utils')

const { SECRET_ID, AWS_DEFAULT_REGION, AWS_SESSION_TOKEN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env

const secretManager = new aws.SecretsManager({
  credentials: new aws.Credentials({
    sessionToken: AWS_SESSION_TOKEN,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }),
  region: AWS_DEFAULT_REGION,
  apiVersion: '2017-10-17',
})

let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (process.env.VALIDATOR_ADDRESS_PRIVATE_KEY) {
    return process.env.VALIDATOR_ADDRESS_PRIVATE_KEY
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
  const privateKey = await getValidatorKey()
  if (!privateKey) {
    throw new Error('Failed to get validator private key from AWS')
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
