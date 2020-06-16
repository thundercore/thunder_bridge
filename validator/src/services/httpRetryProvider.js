const fetch = require('node-fetch')
const promiseRetry = require('promise-retry')
const deepmerge = require('deepmerge')
const Sentry = require('@sentry/node')

const defaultOptions = {
  retry: {
    retries: 0,
  },
}

class HttpRetryProviderError extends Error {
  constructor(message, errors) {
    super(message)
    this.errors = errors
  }
}

function HttpRetryProvider(urls, options = {}) {
  if (!(this instanceof HttpRetryProvider)) {
    return new HttpRetryProvider(urls)
  }

  if (!urls || !urls.length) {
    throw new TypeError(`Invalid URLs: '${urls}'`)
  }

  this.urls = urls
  this.options = deepmerge(defaultOptions, options)
  this.currentIndex = 0
}

HttpRetryProvider.prototype.send = async function send(payload, callback) {
  // save the currentIndex to avoid race condition
  const { currentIndex } = this

  try {
    const [result, index] = await promiseRetry((retry) => {
      return trySend(payload, this.urls, currentIndex).catch((e) => {
        Sentry.captureException(e)
        retry(e)
      })
    }, this.options.retry)
    this.currentIndex = index
    callback(null, result)
  } catch (e) {
    callback(e)
  }
}

async function trySend(payload, urls, initialIndex) {
  const errors = []

  let index = initialIndex
  for (let count = 0; count < urls.length; count++) {
    const url = urls[index]
    try {
      const result = await fetch(url, {
        headers: {
          'Content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) {
          const text = await response.text()
          Sentry.addBreadcrumb({
            category: 'http-retry-provider',
            message: 'fetch fail',
            level: Sentry.Severity.Error,
            data: {
              urls: this.urls,
              url,
              index,
              text,
              status: response.status,
            },
          })
          throw new Error(`[${response.status}: ${url}]: ${text}`)
        }
        return response.json()
      })
      return [result, index]
    } catch (e) {
      // log error here
      console.log({ error: e.message }, 'fetch fail')
      errors.push(e)
    }
    index = (index + 1) % urls.length
  }

  throw new HttpRetryProviderError('Request failed for all urls', errors)
}

module.exports = HttpRetryProvider
module.exports.HttpRetryProviderError = HttpRetryProviderError
