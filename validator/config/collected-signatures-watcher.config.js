const baseConfig = require('./base.config')

const id = `${baseConfig.id}-collected-signatures`

module.exports = {
  ...baseConfig.bridgeConfig,
  ...baseConfig.homeConfig,
  ...baseConfig.env,
  event: 'CollectedSignatures',
  queue: 'foreign',
  name: `watcher-${id}`,
  id
}
