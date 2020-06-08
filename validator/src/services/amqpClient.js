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
  const sendToQueue = data => channelWrapper.sendToQueue(queueName, data, { persistent: true })

  cb({ sendToQueue, channel: channelWrapper })
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
      channel.assertExchange(retryQueue, 'topic', { durable: true, noAck: true}),
    ])
  })

  // Setup queue
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertQueue(queueName, { durable: true }),
      channel.assertQueue(retryQueue,
        { durable: true, deadLetterExchange: queueName, messageTtl: config.QUEUE_RETRY_DELAY }),
      channel.assertQueue(receiptQueue, { durable: true }),
    ])
  })

  // Bind exchange to queue
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.bindQueue(queueName, queueName, '#'),
      channel.bindQueue(retryQueue, retryQueue, '#')
    ]);
  })

  const pushReceiptorQueue = data => channelWrapper.sendToQueue(receiptQueue, data, { persistent: true })
  const pushSenderQueue = data => channelWrapper.sendToQueue(retryQueue, data, { persistent: true })
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.prefetch(1),
      channel.consume(queueName, msg => {
          cb({
            msg,
            channel: channelWrapper,
            ackMsg: job => channelWrapper.ack(job),
            nackMsg: job => channelWrapper.nack(job, false, false),
            pushSenderQueue,
            pushReceiptorQueue,
          })
        }
      )
    ])
  })
}

function connectReceiptorQueue({ queueName, cb }) {
  const channelWrapper = connection.createChannel({
    json: true
  })

  const receiptQueue = `${queueName}-receipt`
  const retryQueue = `${queueName}-receipt-retry`
  const sendQueue = queueName
  const sendToQueue = data => channelWrapper.sendToQueue(queueName, data, { persistent: true })

  logger.info(`Connect receiptor to consumer queue: ${receiptQueue} and producer queue: ${sendQueue}`)

  // Setup exchanges for queue and queue-retry
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertExchange(receiptQueue, 'topic', { durable: true }),
      channel.assertExchange(retryQueue, 'topic', { durable: true, noAck: true}),
    ])
  })

  // Setup queue.
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertQueue(sendQueue, { durable: true }),
      channel.assertQueue(receiptQueue, { durable: true }),
      channel.assertQueue(retryQueue,
        { durable: true, deadLetterExchange: receiptQueue, messageTtl: config.QUEUE_RETRY_DELAY }),
    ])
  })

  // Bind exchange to queue
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.bindQueue(receiptQueue, receiptQueue, '#'),
      channel.bindQueue(retryQueue, retryQueue, '#')
    ]);
  })

  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.prefetch(1),
      channel.consume(receiptQueue, msg => {
          cb({
            msg,
            channel: channelWrapper,
            ackMsg: job => channelWrapper.ack(job),
            retryMsg: job => {
              let task = JSON.parse(job.content.toString())
              channelWrapper.sendToQueue(retryQueue, task)
              channelWrapper.nack(job, false, false)
            },
            rejectMsg: job => channelWrapper.nack(job, false, false),
            sendToQueue
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
