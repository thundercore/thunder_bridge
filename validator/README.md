# TokenBridge validator software

# How to Use

## Installation and Deployment

### Run Validator software

Go to [deployment](./deployment) folder and follow instructions in **Validator** section.

## Rollback the Last Processed Block in Redis

If the bridge does not handle an event properly (i.e. a transaction stalls due to a low gas price), the Redis DB can be rolled back. You must identify which watcher needs to re-run. For example, if the validator signatures were collected but the transaction with signatures was not sent to the Foreign network, the `collected-signatures` watcher must look at the block where the corresponding `CollectedSignatures` event was raised.

Commands:

1. `cd ../deployment/validator`
2. `docker-compose run bridge resetLastBlock <WATCHER_NAME> <BLOCK_NUMBER>`
   - `WATCHER_NAME` could be: `signature-request`, `affirmation-request`, `collected-signatures`
3. `docker-compose run bridge resetNonce <NETWORK> <NONCE>`
   - `NETWORK` could be: `home`, `foreign`

## Configuration parameters

| Variable                            | Description                                                                                                                                                                                                                                                                                                                                                                                          | Values                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `BRIDGE_MODE`                       | The bridge mode. The bridge starts listening to a different set of events based on this parameter.                                                                                                                                                                                                                                                                                                   | `ERC_TO_ERC`                                            |
| `HOME_RPC_URL`                      | The HTTPS URL(s) used to communicate to the RPC nodes in the Home network. Several URLs can be specified, delimited by spaces. If the connection to one of these nodes is lost the next URL is used for connection.                                                                                                                                                                                  | URL(s)                                                  |
| `HOME_BRIDGE_ADDRESS`               | The address of the bridge contract address in the Home network. It is used to listen to events from and send validators' transactions to the Home network.                                                                                                                                                                                                                                           | hexidecimal beginning with "0x"                         |
| `HOME_POLLING_INTERVAL`             | The interval in milliseconds used to request the RPC node in the Home network for new blocks. The interval should match the average production time for a new block.                                                                                                                                                                                                                                 | integer                                                 |
| `FOREIGN_RPC_URL`                   | The HTTPS URL(s) used to communicate to the RPC nodes in the Foreign network. Several URLs can be specified, delimited by spaces. If the connection to one of these nodes is lost the next URL is used for connection.                                                                                                                                                                               | URL(s)                                                  |
| `FOREIGN_BRIDGE_ADDRESS`            | The address of the bridge contract address in the Foreign network. It is used to listen to events from and send validators' transactions to the Foreign network.                                                                                                                                                                                                                                     | hexidecimal beginning with "0x"                         |
| `ERC20_TOKEN_ADDRESS`               | Used with the `ERC_TO_ERC` bridge mode, this parameter specifies the ERC20-compatible token contract address. The token contract address is used to identify transactions that transfer tokens to the Foreign Bridge account address. Omit this parameter with other bridge modes.                                                                                                                   | hexidecimal beginning with "0x"                         |
| `FOREIGN_POLLING_INTERVAL`          | The interval in milliseconds used to request the RPC node in the Foreign network for new blocks. The interval should match the average production time for a new block.                                                                                                                                                                                                                              | integer                                                 |
| `HOME_GAS_PRICE_ORACLE_URL`         | The URL used to get a JSON response from the gas price prediction oracle for the Home network. The gas price provided by the oracle is used to send the validator's transactions to the RPC node. Since it is assumed that the Home network has a predefined gas price (e.g. the gas price in the Core of POA.Network is `1 GWei`), the gas price oracle parameter can be omitted for such networks. | URL                                                     |
| `HOME_GAS_PRICE_SPEED_TYPE`         | Assuming the gas price oracle responds with the following JSON structure: `{"fast": 20.0, "block_time": 12.834, "health": true, "standard": 6.0, "block_number": 6470469, "instant": 71.0, "slow": 1.889}`, this parameter specifies the desirable transaction speed. The speed type can be omitted when `HOME_GAS_PRICE_ORACLE_URL` is not used.                                                    | `instant` / `fast` / `standard` / `slow`                |
| `HOME_GAS_PRICE_FALLBACK`           | The gas price (in Wei) that is used if both the oracle and the fall back gas price specified in the Home Bridge contract are not available.                                                                                                                                                                                                                                                          | integer                                                 |
| `HOME_GAS_PRICE_UPDATE_INTERVAL`    | An interval in milliseconds used to get the updated gas price value either from the oracle or from the Home Bridge contract.                                                                                                                                                                                                                                                                         | integer                                                 |
| `FOREIGN_GAS_PRICE_ORACLE_URL`      | The URL used to get a JSON response from the gas price prediction oracle for the Foreign network. The provided gas price is used to send the validator's transactions to the RPC node. If the Foreign network is Ethereum Foundation mainnet, the oracle URL can be: https://gasprice.poa.network. Otherwise this parameter can be omitted.                                                          | URL                                                     |
| `FOREIGN_GAS_PRICE_SPEED_TYPE`      | Assuming the gas price oracle responds with the following JSON structure: `{"fast": 20.0, "block_time": 12.834, "health": true, "standard": 6.0, "block_number": 6470469, "instant": 71.0, "slow": 1.889}`, this parameter specifies the desirable transaction speed. The speed type can be omitted when `FOREIGN_GAS_PRICE_ORACLE_URL`is not used.                                                  | `instant` / `fast` / `standard` / `slow`                |
| `FOREIGN_GAS_PRICE_FALLBACK`        | The gas price (in Wei) used if both the oracle and fall back gas price specified in the Foreign Bridge contract are not available.                                                                                                                                                                                                                                                                   | integer                                                 |
| `FOREIGN_GAS_PRICE_UPDATE_INTERVAL` | The interval in milliseconds used to get the updated gas price value either from the oracle or from the Foreign Bridge contract.                                                                                                                                                                                                                                                                     | integer                                                 |
| `VALIDATOR_ADDRESS_PRIVATE_KEY`     | The private key of the bridge validator used to sign confirmations before sending transactions to the bridge contracts. The validator account is calculated automatically from the private key. Every bridge instance (set of watchers and senders) must have its own unique private key. The specified private key is used to sign transactions on both sides of the bridge.                        | hexidecimal without "0x"                                |
| `HOME_START_BLOCK`                  | The block number in the Home network used to start watching for events when the bridge instance is run for the first time. Usually this is the same block where the Home Bridge contract is deployed. If a new validator instance is being deployed for an existing set of validators, the block number could be the latest block in the chain.                                                      | integer                                                 |
| `FOREIGN_START_BLOCK`               | The block number in the Foreign network used to start watching for events when the bridge instance runs for the first time. Usually this is the same block where the Foreign Bridge contract was deployed to. If a new validator instance is being deployed for an existing set of validators, the block number could be the latest block in the chain.                                              | integer                                                 |
| `QUEUE_URL`                         | RabbitMQ URL used by watchers and senders to communicate to the message queue. Typically set to: `amqp://127.0.0.1`.                                                                                                                                                                                                                                                                                 | local URL                                               |
| `REDIS_URL`                         | Redis DB URL used by watchers and senders to communicate to the database. Typically set to: `redis://127.0.0.1:6379`.                                                                                                                                                                                                                                                                                | local URL                                               |
| `REDIS_LOCK_TTL`                    | Threshold in milliseconds for locking a resource in the Redis DB. Until the threshold is exceeded, the resource is unlocked. Usually it is `1000`.                                                                                                                                                                                                                                                   | integer                                                 |
| `ALLOW_HTTP`                        | **Only use in test environments - must be omitted in production environments.**. If this parameter is specified and set to `yes`, RPC URLs can be specified in form of HTTP links. A warning that the connection is insecure will be written to the logs.                                                                                                                                            | `yes` / `no`                                            |
| `LOG_LEVEL`                         | Set the level of details in the logs.                                                                                                                                                                                                                                                                                                                                                                | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `MAX_PROCESSING_TIME`               | The workers processes will be killed if this amount of time (in milliseconds) is ellapsed before they finish processing. It is recommended to set this value to 4 times the value of the longest polling time (set with the `HOME_POLLING_INTERVAL` and `FOREIGN_POLLING_INTERVAL` variables). To disable this, set the time to 0.                                                                   | integer                                                 |`
| `SECRET_ID`                         | secret id stores in secret manager                                                                                                                                                                                                                                                                                                                                                                   | string                                                  |

## Useful Commands for Development

### RabbitMQ

| Command                        | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `rabbitmqctl list_queues`      | List all queues                               |
| `rabbitmqctl purge_queue home` | Remove all messages from `home` queue         |
| `rabbitmqctl status`           | check if rabbitmq server is currently running |
| `rabbitmq-server`              | start rabbitMQ server                         |

### Redis

Use `redis-cli`

| Command                                         | Description                                    |
| ----------------------------------------------- | ---------------------------------------------- |
| `KEYS *`                                        | Returns all keys                               |
| `SET signature-request:lastProcessedBlock 1234` | Set key to hold the string value.              |
| `GET signature-request:lastProcessedBlock`      | Get the key value.                             |
| `DEL signature-request:lastProcessedBlock`      | Removes the specified key.                     |
| `FLUSHALL`                                      | Delete all the keys in all existing databases. |
| `redis-cli ping`                                | check if redis is running.                     |
| `redis-server`                                  | start redis server.                            |

## Testing

```bash
npm run test
```

### ERC20-to-ERC20 Mode Testing

1. `cd ../deployment/validator`
2. Make sure you have filled TESTING section in `.env`
3. `docker-compose run bridge sendFromForeignToHome` to send bridgable token from Foreign to Home
4. `docker-compose run bridge sendFromHomeToForeign` to send bridgable token from Home to Foreign

### Configuration parameters for testing

| Variable                    | Description                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_ADDRESS`              | An account - the current owner of coins/tokens.                                                                                                                                                                                                                                 |
| `USER_ADDRESS_PRIVATE_KEY`  | A private key belonging to the account.                                                                                                                                                                                                                                         |
| `HOME_MIN_AMOUNT_PER_TX`    | Value (in _eth_ or tokens) to be sent in one transaction for the Home network. This should be greater than or equal to the value in the contract. The default value in that file is 500000000000000000, which is equivalent to 0.5.                                             |
| `FOREIGN_CUSTOM_RECIPIENT`  | New recipient on the Foreign side during Home to Foreign transfer. Usually recepient is the same as sender.                                                                                                                                                                     |
| `HOME_TEST_TX_GAS_PRICE`    | The gas price (in Wei) that is used to send transactions in the Home network .                                                                                                                                                                                                  |
| `FOREIGN_BRIDGE_ADDRESS`    | Address of the bridge in the Foreign network to send transactions.                                                                                                                                                                                                              |
| `FOREIGN_MIN_AMOUNT_PER_TX` | Value (in _eth_ or tokens) to be sent in one transaction for the Foreign network. This should be greater than or equal to the value specified in the `poa-bridge-contracts/deploy/.env` file. The default value in that file is 500000000000000000, which is equivalent to 0.5. |
| `HOME_CUSTOM_RECIPIENT`     | New recipient on the Home side during Foreign to Home transfer. Usually recepient is the same as sender.                                                                                                                                                                        |
| `FOREIGN_TEST_TX_GAS_PRICE` | The gas price (in Wei) that is used to send transactions in the Foreign network .                                                                                                                                                                                               |

## License

[![License: LGPL v3.0](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)

This project is licensed under the GNU Lesser General Public License v3.0. See the [LICENSE](LICENSE) file for details.
