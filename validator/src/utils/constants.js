module.exports = {
  MAX_CONCURRENT_EVENTS: 50,
  RETRY_CONFIG: {
    retries: 10,
    factor: 2,
    maxTimeout: 360000,
    randomize: false
  },
  DEFAULT_UPDATE_INTERVAL: 600000,
  EXIT_CODES: {
    GENERAL_ERROR: 1,
    INCOMPATIBILITY: 10,
    MAX_TIME_REACHED: 11,
    INSUFFICIENT_FUNDS: 12,
  },
  GAS_PRICE_BOUNDARIES: {
    MIN: 1,
    MAX: 250
  },
  OBSERVABLE_METHODS: {
    transfer: {
      signature: '0xa9059cbb',
      callDataLength: 202
    },
    transferAndCall: {
      signature: '0x4000aea0',
      callDataLength: 330
    }
  },
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000'
}
