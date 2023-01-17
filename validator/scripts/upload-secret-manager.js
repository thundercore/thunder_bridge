require('dotenv').config()
const aws = require('aws-sdk')

const { TOKEN, REGION, ACC_KEY_ID, SECRET_ACC_KEY, SECRET } = process.env

const secretManager = new aws.SecretsManager({
  credentials: new aws.Credentials(ACC_KEY_ID, SECRET_ACC_KEY),
  region: REGION,
  apiVersion: '2017-10-17',
})

async function main() {
  if (!REGION || !ACC_KEY_ID || !SECRET_ACC_KEY) {
    throw new Error('AWS credentials are not specified')
  }

  const data = await secretManager
    .createSecret({
      ClientRequestToken: TOKEN,
      Description: 'Encrypted secret',
      Name: 'Secret Name',
      SecretString: SECRET,
    })
    .promise()

  console.log(`secret created: ${data.ARN}`)
}

main().catch((e) => console.log(e))
