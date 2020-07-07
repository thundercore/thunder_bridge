const Redis = require('ioredis')

const lastProcessedLengthKey = 'monitorLastProcessedLength'
const lastProcessedBlockKey = 'monitorLastProcessedBlock'

Redis.prototype.getProcessedResult = async function (token) {
  const lengthStr = await this.get(`${token}-${lastProcessedLengthKey}`)
  console.log(`${token} getLastProcessedLength`, lengthStr)
  return JSON.parse(lengthStr)
}

Redis.prototype.storeProcessedResult = async function (token, lenObj, homeBlockNumber, foreignBlockNumber) {
  console.log(`${token} storeProcessedResult`, lenObj, {homeBlockNumber, foreignBlockNumber})
  await Promise.all([
    this.set(`${token}-${lastProcessedLengthKey}`, JSON.stringify(lenObj)),
    this.set(`${token}-${lastProcessedBlockKey}-home`, homeBlockNumber),
    this.set(`${token}-${lastProcessedBlockKey}-foreign`, foreignBlockNumber)
  ])
}

Redis.prototype.getProcessedBlock = async function (token) {
  const home = await this.get(`${token}-${lastProcessedBlockKey}-home`)
  const foreign = await this.get(`${token}-${lastProcessedBlockKey}-foreign`)
  console.log(`${token} getProcessedBlock home:${home} foreign:${foreign}`)
  return [home, foreign]
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
