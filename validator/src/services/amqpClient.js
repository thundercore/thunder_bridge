require('dotenv').config()
const config = require('../../config')
const connection = require('amqp-connection-manager').connect(config.QUEUE_URL)
const logger = require('./logger')

connection.on('connect', (conn, e) => {
  if (e !== undefined) {
    logger.error(e, 'Connect to amqp broker failed')
  } else {
    logger.info('Connected to amqp Broker')
  }
})

connection.on('disconnect', (e) => {
  logger.error(e, 'Disconnected from amqp Broker')
})

function connectWatcherToQueue({ queueName, cb }) {
  const channelWrapper = connection.createChannel({
    json: true,
    setup(channel) {
      return Promise.all([channel.assertQueue(queueName, { durable: true })])
    }
  })

  logger.info(`Connect watcher to producer queue: ${queueName}`)
  const enqueueSender = data => channelWrapper.sendToQueue(queueName, data, { persistent: true })

  cb({ enqueueSender, channel: channelWrapper })
}

function connectSenderToQueue({ queueName, cb }) {
  const channelWrapper = connection.createChannel({
    json: true
  })

  const receiptQueue = `${queueName}-receipt`
  const retryQueue = `${queueName}-retry`

  logger.info(`Connect sender to consumer queue: ${queueName} and producer queue: ${receiptQueue}`)

  // Setup exchanges for queue and queue-retry
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertExchange(queueName, 'topic', { durable: true }),
      channel.assertQueue(queueName, { durable: true }),
      channel.assertQueue(receiptQueue, { durable: true }),
      channel.bindQueue(queueName, queueName, '#'),
    ])
  })

  // Setup retry queue
  channelWrapper.addSetup(channel => {
    const tasks = createRetryQueueTasks(retryQueue, queueName, channel)
    return Promise.all(tasks)
  })


  const enqueueReceiptor = data => channelWrapper.sendToQueue(receiptQueue, data, { persistent: true })
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.prefetch(1),
      channel.consume(queueName, msg => {
          cb({
            msg,
            channel: channelWrapper,
            ackMsg: job => channelWrapper.ack(job),
            nackMsg: job => channelWrapper.nack(job, false, false),
            enqueueSender: data => {
              var retry = msg.properties.headers['x-retry-count'] || 0
              retry = retry > config.QUEUE_RETRY_LIMIT ? config.QUEUE_RETRY_LIMIT : retry
              const targetQueue = getRetryQueueName(retryQueue, retry)
              logger.debug({targetQueue}, 'push task to retry queue')
              channelWrapper.sendToQueue(targetQueue, data, { headers: { 'x-retry-count': retry+1 } })
            },
            enqueueReceiptor,
          })
        }
      )
    ])
  })
}

function getRetryQueueName(retryQueue, retry) {
  return `${retryQueue}-${retry}`
}

function createRetryQueueTasksFromOption(retryQueue, destQueue, channel, options) {
  const tasks = []

  for (var option in options) {
    const waittime = options[option]
    const name = getRetryQueueName(retryQueue, waittime)
    tasks.push(
      channel.assertExchange(name, 'topic', { durable: true, noAck: true}),
    )
    tasks.push(
      channel.assertQueue(name, { durable: true, deadLetterExchange: destQueue, messageTtl: waittime })
    )
    tasks.push(
      channel.bindQueue(name, name, '#')
    )
  }

  return tasks
}

function createRetryQueueTasks(retryQueue, destQueue, channel) {
  const tasks = []
  let delay = config.QUEUE_RETRY_DELAY
  for (var i=0; i<=config.QUEUE_RETRY_LIMIT; i++){
    const name = getRetryQueueName(retryQueue, i)
    tasks.push(
      channel.assertExchange(name, 'topic', { durable: true, noAck: true}),
    )
    tasks.push(
      channel.assertQueue(name, { durable: true, deadLetterExchange: destQueue, messageTtl: delay })
    )
    tasks.push(
      channel.bindQueue(name, name, '#')
    )
    delay *= 2
  }
  return tasks
}

function connectReceiptorQueue({ queueName, cb, queueOptions }) {
  const channelWrapper = connection.createChannel({
    json: true
  })

  const receiptQueue = `${queueName}-receipt`
  const retryQueue = `${queueName}-receipt-retry`
  const sendQueue = queueName

  logger.info(`Connect receiptor to consumer queue: ${receiptQueue} and producer queue: ${sendQueue}`)

  // Setup exchanges for queue and queue-retry
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertExchange(receiptQueue, 'topic', { durable: true }),
      channel.assertQueue(sendQueue, { durable: true }),
      channel.assertQueue(receiptQueue, { durable: true }),
      channel.bindQueue(receiptQueue, receiptQueue, '#'),
    ])
  })

  // Setup retry queue.
  channelWrapper.addSetup(channel => {
    const tasks = createRetryQueueTasksFromOption(retryQueue, receiptQueue, channel, queueOptions)
    return Promise.all(tasks)
  })


  const enqueueSender = data => channelWrapper.sendToQueue(queueName, data, { persistent: true })
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.prefetch(1),
      channel.consume(receiptQueue, msg => {
          cb({
            msg,
            channel: channelWrapper,
            ackMsg: job => channelWrapper.ack(job),
            retryMsg: (job, target) => {
              const key = target? target: 'default'
              const targetQueue = getRetryQueueName(retryQueue, queueOptions[key])
              logger.debug({targetQueue, key}, 'push task to retry queue')
              let task = JSON.parse(job.content.toString())
              channelWrapper.sendToQueue(targetQueue, task)
              channelWrapper.nack(job, false, false)
            },
            rejectMsg: job => channelWrapper.nack(job, false, false),
            enqueueSender
          })
        }
      )
    ])
  })
}

module.exports = {
  connectWatcherToQueue,
  connectSenderToQueue,
  connectReceiptorQueue,
  connection
}
