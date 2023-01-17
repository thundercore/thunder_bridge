require('dotenv').config()

const aws = require('aws-sdk')

const { PRIVATE_KEY, KEY_ID } = process.env

const kms = new aws.KMS()

async function main() {
  const encryptedParam = {
    KeyId: KEY_ID,
    Plaintext: Buffer.from(PRIVATE_KEY, 'utf-8'),
  }

  const res = await kms.encrypt(encryptedParam).promise()

  console.log(res.CiphertextBlob.toString('base64'))
}

main().catch((e) => console.log(e))
