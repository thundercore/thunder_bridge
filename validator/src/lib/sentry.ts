import os from 'os'
import config from '../../config'
import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';

declare global {
  namespace NodeJS {
    interface Global {
      __rootdir__: string;
    }
  }
}

global.__rootdir__ = __dirname || process.cwd();

export default function init() {
  Sentry.init({
    serverName: os.hostname(),
    integrations: [new RewriteFrames({
      root: global.__rootdir__
    })]
  });

  Sentry.configureScope(function(scope) {
  if (config.VALIDATOR_TAG) {
    scope.setTag('service', `${config.name}-${config.VALIDATOR_TAG}`)
  } else {
    scope.setTag("service", config.name)
  }

  scope.setTag("web3Host", config.web3.currentProvider.urls.toString())
  })

  Sentry.captureMessage(`Init ${config.SENTRY_ENVIRONMENT} validator`, Sentry.Severity.Debug)
}