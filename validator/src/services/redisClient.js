const Redis = require('ioredis')
const Redlock = require('redlock')
const logger = require('./logger')
const config = require('../../config')

const redis = new Redis(config.REDIS_URL)
const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 200,
  retryDelay: 500,
  retryJitter: 500
})

redis.on('connect', () => {
  logger.info(`Connected to redis ${config.REDIS_URL}`)
})

redis.on('error', () => {
  logger.error('Disconnected from redis')
})

redlock.on('clientError', function(err) {
  console.error('A redlock error has occurred:', err);
});

module.exports = {
  redis,
  redlock
}
