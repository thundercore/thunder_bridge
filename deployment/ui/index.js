const envalid = require('envalid')
const fetch = require("node-fetch");
const fs = require('fs')
const Sentry = require('@sentry/node')
const pino = require('pino')
const logger = pino({
  prettyPrint: {
    translateTime: true,
  },
})

const validations = {
    MONITOR_STATUS_URL: envalid.str(),
    REACT_APP_MONITOR_STATUS_FILE: envalid.str(),
    INTERVAL: envalid.num({default: 60*1000}),
    SENTRY_DSN: envalid.str({default: ''}),
    SENTRY_ENVIRONMENT: envalid.str({default: 'dev'}),
}

const env = envalid.cleanEnv(process.env, validations, {})
process.env = Object.assign({}, process.env, env)

async function crawl() {
    try {
        const resp = await fetch(env.MONITOR_STATUS_URL).then(res => res.json())
        logger.info(`Fetch data from ${env.MONITOR_STATUS_URL}`)
        fs.writeFileSync(env.REACT_APP_MONITOR_STATUS_FILE, JSON.stringify(resp))
        logger.info(`Save data to ${env.REACT_APP_MONITOR_STATUS_FILE}`)
        logger.info(`Sleep ${env.INTERVAL} for next round`)
    } catch(e) {
        Sentry.captureException(e)
        logger.fatal(e, "Fetch status file failed, wait 1s for slowly shutdown")
        await new Promise(res => setTimeout(res, 1000))
        process.exit(17)
    }
}

async function main() {
    if (env.SENTRY_DSN !== '') {
        logger.info(`Init sentry: ${env.SENTRY_DSN}`)
        Sentry.init({
            dsn: env.SENTRY_DSN,
        })
        Sentry.configureScope(function (scope) {
            scope.setTag("service", "bridgeui_crawler")
        })
    }

    setImmediate(crawl, env.INTERVAL)
    setInterval(crawl, env.INTERVAL)
}

main()