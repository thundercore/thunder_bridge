const pino = require('pino')

const config = require('../../config')

const logger = pino({
  name: config.name,
  level: process.env.LOG_LEVEL || 'debug',
  base:
    process.env.NODE_ENV === 'production'
      ? {
          validator: process.env.VALIDATOR_ADDRESS
        }
      : {}
})

module.exports = logger