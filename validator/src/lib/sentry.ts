import os from 'os'
import config from '../../config'
import * as Sentry from '@sentry/node';


export default function init() {
  Sentry.init({
    serverName: os.hostname()
  });

  Sentry.configureScope(function(scope) {
    scope.setTag("service", config.name)
    scope.setTag("web3Host", config.web3.host)
  })
}