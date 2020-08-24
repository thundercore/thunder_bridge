const pino = require('pino')

const config = require('../../config')

const logger = pino({
  name: config.name,
  level: config.LOG_LEVEL,
  base:
    config.NODE_ENV === 'production'
      ? {
          validator: config.VALIDATOR_ADDRESS
        }
      : {}
})

module.exports = logger