require('dotenv').config()
const aws = require('aws-sdk')
const { privateKeyToAddress } = require('../src/utils/utils')

const { SECRET_ID, AWS_DEFAULT_REGION, ROLE_ARN, ROLE_SESSION_NAME } = process.env

const sts = new aws.STS({
  credentials: new aws.Credentials({
    region: AWS_DEFAULT_REGION,
  }),
})
let secretManager = null
let cachedValidatorPrivateKey = null

async function getValidatorKey() {
  if (process.env.VALIDATOR_ADDRESS_PRIVATE_KEY) {
    return process.env.VALIDATOR_ADDRESS_PRIVATE_KEY
  }

  if (cachedValidatorPrivateKey) {
    return cachedValidatorPrivateKey
  } else {
    if (secretManager === null) {
      const role = await sts
        .assumeRole({
          RoleArn: ROLE_ARN,
          RoleSessionName: ROLE_SESSION_NAME,
        })
        .promise()
      secretManager = new aws.SecretsManager({
        credentials: new aws.Credentials({
          sessionToken: role.Credentials.SessionToken,
          accessKeyId: role.Credentials.AccessKeyId,
          secretAccessKey: role.Credentials.SecretAccessKey,
        }),
        region: AWS_DEFAULT_REGION,
        apiVersion: '2017-10-17',
      })
    }

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
