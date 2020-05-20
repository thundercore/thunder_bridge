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

  const sendToQueue = data => channelWrapper.sendToQueue(queueName, data, { persistent: true })

  cb({ sendToQueue, channel: channelWrapper })
}

function connectSenderToQueue({ queueName, cb }) {
  const channelWrapper = connection.createChannel({
    json: true
  })

  console.log(`connect sender to queue: ${queueName}`)
  channelWrapper.addSetup(channel => {
    return Promise.all([
      channel.assertQueue(queueName, { durable: true }),
      channel.prefetch(1),
      channel.consume(queueName, msg => {
          cb({
            msg,
            channel: channelWrapper,
            ackMsg: job => channelWrapper.ack(job),
            nackMsg: job => channelWrapper.nack(job, false, true),
            rejectMsg: job => channelWrapper.nack(job, false, false),
          })
        }
      )
    ])
  })
}

module.exports = {
  connectWatcherToQueue,
  connectSenderToQueue,
  connection
}
