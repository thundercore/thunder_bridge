const pino = require('pino')

const config = require('../../config')

const logger = pino({
  name: config.name,
  level: config.LOG_LEVEL,
  prettyPrint: {
    translateTime: true,
  },
  base:
    config.NODE_ENV === 'production'
      ? {
          validator: config.VALIDATOR_ADDRESS
        }
      : {}
})

module.exports = logger