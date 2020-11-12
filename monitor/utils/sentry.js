const Sentry = require('@sentry/node')
const os = require('os')

function initSentry() {
  Sentry.init({
    serverName: os.hostname(),
  })

  Sentry.captureMessage(`Init monitor`)
}


module.exports = {
  initSentry
}