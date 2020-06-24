const Redis = require('ioredis')

const lastProcessedLengthKey = 'monitorLastProcessedLength'
const lastProcessedBlockKey = 'monitorLastProcessedBlock'

Redis.prototype.getProcessedLength = async function (token) {
  const lengthStr = await this.get(`${token}-${lastProcessedLengthKey}`)
  console.log(`${token} getLastProcessedLength`, lengthStr)
  return JSON.parse(lengthStr)
}

Redis.prototype.setProcessedLength = async function (token, lenObj) {
  console.log(`${token} setLastProcessedLength`, lenObj)
  return await this.set(`${token}-${lastProcessedLengthKey}`, JSON.stringify(lenObj))
}

Redis.prototype.getProcessedBlock = async function (token) {
  const home = await this.get(`${token}-${lastProcessedBlockKey}-home`)
  const foreign = await this.get(`${token}-${lastProcessedBlockKey}-foreign`)
  console.log(`${token} getProcessedBlock home:${home} foreign:${foreign}`)
  return [home, foreign]
}

Redis.prototype.setProcessedBlock = async function (token, homeBlockNumber, foreignBlockNumber) {
  await this.set(`${token}-${lastProcessedBlockKey}-home`, homeBlockNumber)
  await this.set(`${token}-${lastProcessedBlockKey}-foreign`, foreignBlockNumber)
  console.log(`${token} setProcessedBlock home:${homeBlockNumber} foreign:${foreignBlockNumber}`)
}

function newRedis(url) {
  const redis = new Redis(url)
  redis.on('connect', () => {
    console.log(`Connected to redis ${url}`)
  })

  redis.on('error', () => {
    console.log('Disconnected from redis')
  })
  return redis
}

module.exports = {
  newRedis,
}
