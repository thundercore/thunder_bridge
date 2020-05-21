const connection = require('amqp-connection-manager').connect('amqp://127.0.0.1:5672')
const Web3 = require('web3')

var web3 = new Web3('http://localhost:7545');
var deployed = require('../data/deployed.json')
var erc20Abi = require('../abis/ERC20.abi.json')

connection.on('connect', (conn, e) => {
  if (e !== undefined) {
    console.log(e, 'Connect to amqp broker failed')
  } else {
    console.log('Connected to amqp Broker')
  }
})

connection.on('disconnect', (e) => {
  console.log(e, 'Disconnected from amqp Broker')
})


async function main() {
  const queueName = "foreign"
  const channelWrapper = connection.createChannel({
    json: true,
    setup(channel) {
      return Promise.all([channel.assertQueue(queueName, { durable: true })])
    }
  })

  let erc20 = new web3.eth.Contract(erc20Abi, deployed.erc20Token.address)
  console.log(erc20.address)
  const r = await erc20.methods.transfer(deployed.foreignBridge.address, web3.utils.toWei('0.01')).send({from: '0x6Da72903E0BD3F4D79734dFC459a31093A2B8327'})
  console.log(r)
  let task = {
      eventType: 'erc-erc-affirmation-request',
      event: r.events.Transfer,
    }

  await channelWrapper.sendToQueue(queueName, task, { persistent: true })
}

main()