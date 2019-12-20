"""
Utility class which help to execute transactions using web3py (https://github.com/ethereum/web3.py)
NOTE: No support of parallel transactions for now.
"""

import datetime
import time
import logging

from binascii import hexlify, unhexlify
import eth_utils
import eth_abi
from web3 import Web3
from requests.exceptions import ConnectionError as RConnectionError

LOG = logging.getLogger(__name__)

# pylint: disable=too-many-public-methods
class W3Helper:
    """ Wrapper around W3 api """
    # At any point in time, the value denotes the nonce that will be used for next transaction.
    DEFAULT_GAS_PRICE = 9 * 10 ** 9  # 9 gwei
    DEFAULT_GAS = 22000
    FLAG = 0x1

    def __init__(self, fullnode_endpoint):
        self.web3 = Web3(Web3.HTTPProvider(fullnode_endpoint))

    def call_api(self, method, *args):
        '''Call RPC api'''
        try:
            return self.web3.manager.request_blocking(method, list(args))
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                return self.web3.manager.request_blocking(method, list(args))
            else:
                raise

    def eth_call(self, transaction):
        '''Call eth_call'''
        try:
            return self.eth.call(transaction)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                return self.eth.call(transaction)
            else:
                raise

    def get_balance(self, acc, block_identifier='latest'):
        """ Get current balance for given account """
        balance = 0
        try:
            balance = self.eth.getBalance(acc, block_identifier)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                balance = self.eth.getBalance(acc, block_identifier)
            else:
                raise
        LOG.debug('Balance of %s = %s', acc, balance)
        return balance

    def _create_account(self):
        account = None
        try:
            account = self.eth.account.create()
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                account = self.eth.account.create()
            else:
                raise
        LOG.debug('Newly created test account %s, private key %s',
                  account.address, account.privateKey.hex())
        return account

    def send_tokens(self, private_key, dest_acc, value, data=b''):
        '''Send tokens to account'''
        addr = self.eth.account.privateKeyToAccount(private_key).address
        tx = {
            "value": value,
            "to": dest_acc,
            "data": data,
            "from": addr,
            "gasPrice": self.eth.gasPrice
        }
        LOG.debug(tx)
        try:
            gas = self.eth.estimateGas(tx)
            tx["gas"] = gas
            tx['nonce'] = self.get_nonce_for_next_transaction(addr)

            return self.execute_and_wait_for_transaction(private_key, tx)
        except Exception:
            pass
        return None

    def build_simple_transaction(self, nonce, dest_acc, value, gas_price=0, gas=DEFAULT_GAS):
        """ Builds a simple transaction with specific info """
        gas_price = self.DEFAULT_GAS_PRICE if gas_price == 0 else gas_price
        return dict(
            nonce=nonce,
            gasPrice=gas_price,
            gas=gas,
            to=dest_acc,
            value=value,
            data=b'',
        )

    # pylint: disable=invalid-name
    def build_value_transfer_transaction(self, src_acc, dest_acc, value,
                                         gas_price=0, gas=DEFAULT_GAS):
        """ Builds a simple transaction which sends 'value' amount to given destination account """
        gas_price = self.DEFAULT_GAS_PRICE if gas_price == 0 else gas_price
        txn = self.build_simple_transaction(self.get_nonce_for_next_transaction(src_acc),
                                            dest_acc, value, gas_price, gas)
        return txn

    def build_value_transfer_transactions(self, src_acc, dest_acc, value,
                                          num=2, gas_price=0, gas=DEFAULT_GAS):
        """ Builds a simple transaction which sends 'value' amount to given destination account
            Since get_nonce_for_next_transaction() uses last *executed* txn nonce to get next nonce,
            it doesn't work when building multiple transactions, so we assign nonce value manually.
        """
        gas_price = self.DEFAULT_GAS_PRICE if gas_price == 0 else gas_price
        transactions = []
        nonce = self.get_nonce_for_next_transaction(src_acc)
        for _ in range(num):
            transactions.append(
                self.build_value_transfer_transaction(src_acc, dest_acc, value, gas_price, gas))
            transactions[-1]['nonce'] = nonce
            nonce += 1
        LOG.info("Built %s transactions. First txn nonce:%s Last txn nonce:%s", num,
                 transactions[0]['nonce'], transactions[-1]['nonce'])
        return transactions

    def build_contract(self, contract_interface, src_acc):
        """ Given contract_interface (generated on compiling sol code), builds a transaction which
            can be used to submit the contract.
        """
        contract_tx = (self.eth.contract(abi=contract_interface['abi'],
                                         bytecode=contract_interface['bin'])
                       .constructor()
                       .buildTransaction())

        # quick fix for THUNDER-464
        # currently eth_gasPrice can return 0 in some circumstances causing this tx to fail
        # TODO can delete this when THUNDER-539 is done
        contract_tx['gasPrice'] = self.DEFAULT_GAS_PRICE

        contract_tx['nonce'] = self.get_nonce_for_next_transaction(src_acc)
        return contract_tx

    def sign_transaction(self, src_private_key, transaction):
        """
        Sign the transaction.
        Returns signed transaction.
        :returns: transaction hash
        """
        try:
            return self.eth.account.signTransaction(transaction, src_private_key)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                return self.eth.account.signTransaction(transaction, src_private_key)
            else:
                raise

    def send_raw_transaction(self, raw_transaction):
        """
        Sends raw transaction
        Returns transaction hash.
        :returns: transaction hash
        """
        try:
            return self.eth.sendRawTransaction(raw_transaction)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                return self.eth.sendRawTransaction(raw_transaction)
            else:
                raise

    def execute_transaction(self, src_private_key, transaction):
        """
        Sends the transaction without waiting for it to complete.
        Returns transaction hash.
        :returns: transaction hash
        """
        signed_txn = self.sign_transaction(src_private_key, transaction)
        tx_hash = self.send_raw_transaction(signed_txn.rawTransaction)
        now = datetime.datetime.now()
        LOG.debug("Execute transaction hash = %s on %s", hexlify(tx_hash), str(now))
        return tx_hash, now

    def execute_transactions(self, src_private_key, transactions):
        """
        Sends multiple transactions without waiting for them to complete.
        Returns list of transaction hashes.
        :returns: Array of transaction hashes. Length is same as that of 'transactions' param,
                  where i'th hash corresponds to i'th transaction.
        """
        tx_hash_list = []
        for txn in transactions:
            tx_hash_list.append(self.execute_transaction(src_private_key, txn))
        return tx_hash_list

    def execute_and_wait_for_transaction(self, src_private_key, transaction, timeout=60):
        """
        Sends the transaction and waits for it to complete.
        If transaction gets executed within given timeout, then returns transaction receipt.
        Else throws error.
        :returns: transaction receipt
        """
        tx_hash, _ = self.execute_transaction(src_private_key, transaction)
        LOG.info("TX hash: %s", hexlify(tx_hash))
        receipt = self.wait_receipt_for_transaction(tx_hash, timeout)
        if receipt is None:
            raise TimeoutError("Transaction %s timed out" % hexlify(tx_hash))
        LOG.info("Transaction %s executed. blockHash=%s  blockNumber=%s, cumulativeGasUsed=%s",
                 hexlify(tx_hash), hexlify(receipt['blockHash']), receipt['blockNumber'],
                 receipt['cumulativeGasUsed'])
        if receipt['contractAddress'] is not None:
            LOG.info("Contract address=%s", receipt['contractAddress'])
        return receipt

    def execute_and_wait_for_transactions(self, src_private_key, transactions):
        """ Sends the transactions and waits for them to complete.
        :returns: List of receipts, one for each transaction in-order.
        """
        tx_hash_list_pending = self.execute_transactions(src_private_key, transactions)
        tx_hash_list, _ = zip(*tx_hash_list_pending)
        receipts = self.wait_for_transactions(tx_hash_list)
        return receipts

    def get_transaction(self, tx_hash):
        '''Get TX'''
        try:
            return self.eth.getTransaction(tx_hash)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                return self.eth.getTransaction(tx_hash)
            else:
                raise

    def wait_receipt_for_transaction(self, tx_hash, timeout=60):
        """
        Wait transaction receipt from hash and waits for it to complete.
        If transaction gets executed within given timeout, then returns transaction receipt.
        Else throws error.
        :returns: transaction receipt
        """
        receipt = None
        try:
            receipt = self.eth.waitForTransactionReceipt(tx_hash, timeout)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                receipt = self.eth.waitForTransactionReceipt(tx_hash, timeout)
            else:
                raise
        if receipt is None:
            raise TimeoutError("Transaction %s timed out" % hexlify(tx_hash))
        LOG.debug("Receipt: %s", receipt)
        #wait for receipt is complete
        while not receipt['blockNumber'] and timeout > 0:
            time.sleep(2)
            timeout -= 1
            receipt = self.eth.waitForTransactionReceipt(tx_hash, timeout)
        return receipt

    def get_receipt_for_transaction(self, tx_hash):
        """
        Get transaction receipt from hash
        :returns: transaction receipt
        """
        receipt = None
        try:
            receipt = self.eth.getTransactionReceipt(tx_hash)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                receipt = self.eth.getTransactionReceipt(tx_hash)
            else:
                raise
        return receipt

    def get_nonce_for_next_transaction(self, acc, block_identifier='latest'):
        """ Gets the next nonce value for transaction for a given account, calculated
        as <# of existing transactions>. For example, if an account made 3 transactions
        so far, the nonce value it should use for its next transaction is 3.
        :returns: integer = nonce value to be used for the next transaction
        """
        num_sent_txs = 0
        try:
            num_sent_txs = self.eth.getTransactionCount(acc, block_identifier)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                num_sent_txs = self.eth.getTransactionCount(acc, block_identifier)
            else:
                raise
        LOG.debug("For account: %s, next transaction's nonce should be: %s",
                  acc, num_sent_txs)
        return num_sent_txs

    def get_nonce_for_next_transaction_pending(self, acc):
        """ Exactly the same as get_nonce_for_next_transaction except uses "pending" parameter
        in the web3 call. This should always return the same result as the verison without "pending"
        parameter.
        :returns: integer = nonce value to be used for the next transaction
        """
        return self.get_nonce_for_next_transaction(acc, 'pending')

    def wait_for_transactions(self, tx_hash_list):
        """ Waits for all transactions in tx_hash_list to finish.
            :returns: List of receipts, one for each transaction in-order.
        """
        receipts = []
        for tx_hash in tx_hash_list:
            receipts.append(self.wait_receipt_for_transaction(tx_hash))
        return receipts

    def get_block_for_transaction_receipt(self, receipt):
        """ Gets the block information for the given transaction receipt.
        :returns: block object
        """
        block_num = receipt['blockNumber']
        block = self.get_block(block_num)
        LOG.info("For transactionHash=%s blockNumber=%s transactionIndex=%s from=%s to=%s:",
                 hexlify(receipt['transactionHash']), block_num, receipt['transactionIndex'],
                 receipt['from'], receipt['to'])
        self.debug_log_block_info(block)
        return block

    def get_block(self, block_id='latest', debug=True):
        """ Gets the block information.
        :param block_id Can be block number, block hash or one of predefined params. See web3 doc
                  for this function. If no block id is provided, get the latest block.
        :returns: block object
        """
        block = None
        try:
            block = self.eth.getBlock(block_id)
        except RConnectionError:
            if self.FLAG & 0x1:
                time.sleep(1)
                block = self.eth.getBlock(block_id)
            else:
                raise
        if debug:
            self.debug_log_block_info(block)
        return block

    def create_block_history(self, block_history, stop_event):
        """ Start logging block information till it is stopped."""
        block_previous = self.get_block()
        while not stop_event.is_set():
            now = datetime.datetime.now()
            block = self.get_block()
            if block['number'] != block_previous['number']:
                block_history.append((block, now))
                block_previous = block
            stop_event.wait(0.01)

    def verify_stats(self, receipts, src_acc, src_init_balance, dest_acc, dest_init_balance):
        """ Iterate over receipts and verify that final balances for source and destination
        accounts tally up.
        Populates the block_to_gas_used_map with gas used by these
        """
        count = 1
        src_end_balance = src_init_balance
        dest_end_balance = dest_init_balance
        for receipt in receipts:
            tx_hash = receipt['transactionHash']
            transaction = self.get_transaction(tx_hash)
            block_number = receipt['blockNumber']

            # Calculate txn_fee, and final balances for src and dest account.
            tx_gas_price = transaction['gasPrice']
            tx_cost = self.get_transaction_cost(receipt, tx_gas_price)
            tx_value = transaction['value']
            src_end_balance -= (tx_cost + tx_value)
            dest_end_balance += tx_value
            LOG.debug("Tx:%s (%s) block:%s, src balance: %s, dest balance: %s",
                      count, hexlify(tx_hash), block_number, src_end_balance, dest_end_balance)
            count += 1

        assert dest_end_balance == self.get_balance(dest_acc)
        assert src_end_balance == self.get_balance(src_acc)

    def verify_block_gas_used(self, receipts):
        """ Assert that gas used by txns matches cumulative gas used in the blocks. """
        block_to_gas_used_map = dict()
        for receipt in receipts:
            block_hash = receipt['blockHash']
            if block_hash not in block_to_gas_used_map:
                block_to_gas_used_map[block_hash] = 0
            block_to_gas_used_map[block_hash] += receipt['gasUsed']
        for block_hash, _ in block_to_gas_used_map.items():
            gas_block = 0
            untracked_receipt_gas = 0
            block = self.get_block(block_hash)
            for tx_hash in block['transactions']:
                receipt = self.wait_receipt_for_transaction(tx_hash, 10)
                gas_block += receipt['gasUsed']
                if receipt not in receipts:
                    untracked_receipt_gas += receipt['gasUsed']
            assert block['gasUsed'] == gas_block
            assert block['gasUsed'] == block_to_gas_used_map[block_hash] + untracked_receipt_gas
            LOG.info("Gas used in block %s, tracked transactions %s, untracked %s",
                     hexlify(block_hash), block_to_gas_used_map[block_hash], untracked_receipt_gas)
            LOG.info("Gas used in block %s = %s", hexlify(block_hash), block['gasUsed'])

    @staticmethod
    def debug_log_block_info(block):
        """ Prints the block information for the given block object in debug log.
        """
        LOG.debug("===The block object number=%s===", block['number'])
        LOG.debug("hash=%s", hexlify(block['hash']))
        LOG.debug("parentHash=%s", hexlify(block['parentHash']))
        if 'nonce' in block and block['nonce']:
            LOG.debug("nonce=%s", hexlify(block['nonce']))
        LOG.debug("sha3Uncles=%s", hexlify(block['sha3Uncles']))
        LOG.debug("logsBloom=%s", hexlify(block['logsBloom']))
        LOG.debug("transactionsRoot=%s", hexlify(block['transactionsRoot']))
        LOG.debug("stateRoot=%s", hexlify(block['stateRoot']))
        LOG.debug("totalDifficulty=%s", block['totalDifficulty'])
        LOG.debug("size=%s", block['size'])
        LOG.debug("gasLimit=%s", block['gasLimit'])
        LOG.debug("gasUsed=%s", block['gasUsed'])
        LOG.debug("timestamp=%s(%s)", block['timestamp'],
                  W3Helper.convert_unix_timestamp(block['timestamp']))
        LOG.debug("transactions=%s", block['transactions'])
        LOG.debug("================================")

    @staticmethod
    def convert_unix_timestamp(timestamp):
        """ Convert block timestamp to human readable form.
        :returns: list of transaction hashes
        """
        value = datetime.datetime.fromtimestamp(timestamp)
        _time = value.strftime('%Y-%m-%d %H:%M:%S')
        return _time

    def get_transaction_cost(self, receipt, gas_price=0):
        """ :returns: transaction cost in wei
        """
        gas_price = self.DEFAULT_GAS_PRICE if gas_price == 0 else gas_price
        return receipt['gasUsed'] * gas_price

    def __getattr__(self, name):
        if hasattr(self.web3, name):
            return getattr(self.web3, name)
        else:
            eth = getattr(self.web3, 'eth')
            if hasattr(eth, name):
                return getattr(eth, name)
        return None


class Funcall:
    '''Smart Contract Function Call'''

    @staticmethod
    def encode_funcall(func_type, *args):
        '''Encode for contract method call'''
        func_type = func_type.replace(' ', '')
        signature = hexlify(eth_utils.keccak(func_type.encode()))[:8].decode()
        params = []
        values = list(args)
        idx = func_type.find("(")
        parmstr = func_type[idx+1:-1]
        data = ''
        if parmstr:
            for parm in func_type[idx+1:-1].split(","):
                params.append(parm.strip())
            data = hexlify(eth_abi.encode_abi(params, values)).decode()
        return "0x%s%s" % (signature, data)

    @staticmethod
    def decode_log(event, log):
        '''Decode log'''
        lidx = event.find('(')
        ridx = event.find(')')
        event_name = event[:lidx]
        event_type = event[:ridx+1].replace("i:", "")
        event_params = event[lidx+1:ridx]
        signature = '0x{}'.format(hexlify(eth_utils.keccak(event_type.encode())).decode())

        if log['topics'][0].hex() == signature:
            if event_params == '':
                return event_type
            else:
                params = event_params.split(',')
                parms = []
                values = {}
                j = 1
                #pylint: disable=consider-using-enumerate
                for i in range(len(params)):
                    if params[i].startswith("i:"):
                        values[i] = eth_abi.decode_single(params[i][2:], log['topics'][j])
                        j += 1
                    else:
                        parms.append(params[i])
                if parms:
                    unindex_values = eth_abi.decode_abi(parms, unhexlify(log['data'][2:]))
                    j = 0
                    for i in range(len(params)):
                        if i not in values:
                            #pylint: disable=unsubscriptable-object
                            values[i] = unindex_values[j]
                            j += 1
                    str_values = []
                    for i in range(len(params)):
                        if isinstance(values[i], bytes):
                            str_values.append('0x{}'.format(hexlify(values[i]).decode()))
                        else:
                            str_values.append(str(values[i]))
                return '{}({})'.format(event_name, ', '.join(str_values))
        return None

    @staticmethod
    def decode_logs(events, logs):
        '''Decode logs in receipt'''
        ret = []
        for log in logs:
            for event in events:
                try:
                    rret = Funcall.decode_log(event, log)
                    if rret:
                        ret.append(rret)
                        continue
                except Exception:
                    pass
        return ret

    def __init__(self, contract, attr):
        self.contract = contract
        self.is_event = False
        if isinstance(attr, str) and attr.startswith('event:'):
            self.is_event = True
            self.signature = attr[6:]
            return

        self.ret_type = None
        self.need_data = False
        self.events = []
        if isinstance(attr, tuple):
            self.signature = attr[0]
            self.need_data = attr[1]
            if len(attr) == 3:
                self.events = attr[2]
        else:
            self.signature = attr

        idx = self.signature.find(")")
        if idx > 0:
            self.ret_type = self.signature[idx+1:]
            self.signature = self.signature[:idx+1]

    #pylint: disable=unsubscriptable-object
    def __call__(self, *args, **kwargs):
        if self.is_event:
            def _func(_from, count=1, timeout=120):
                return self.contract.get_logs(self.signature, _from, count=count, timeout=timeout)
            _func.__event__ = self.signature
            return _func

        private_key = None
        extra_data = None
        if not self.ret_type:
            private_key = args[0]
            args = args[1:]
        if self.need_data:
            extra_data = args[-1]
            args = args[:-1]

        data = ''
        if args:
            data = Funcall.encode_funcall(self.signature, *args)
        else:
            data = Funcall.encode_funcall(self.signature)
        if extra_data:
            data = "%s%s" % (data, extra_data[2:])
        if private_key:
            receipt = self.contract.call(private_key, data, **kwargs)
            receipt = dict(receipt)
            if self.events:
                receipt['events'] = Funcall.decode_logs(self.events, receipt['logs'])
            return receipt
        else:
            try:
                ret_data = self.contract.view(data, **kwargs)
                ret = eth_abi.decode_abi([self.ret_type], ret_data)[0]
                LOG.debug("Call %s, return Data: %s", self.signature, ret)
                if self.ret_type == "string":
                    return ret.decode()
                return ret
            except Exception:
                return None

class SmartContract:
    '''Contract Base'''
    def __init__(self, w3h, contract_addr):
        self.w3h = w3h
        self.contract_addr = Web3.toChecksumAddress(contract_addr)
        self.attrs = {}

    def view(self, data):
        '''Call readonly method ...'''
        tx = {
            "value": 0,
            "to": self.contract_addr,
            "data": data,
            "from": self.contract_addr,
            "gasPrice": self.w3h.web3.eth.gasPrice
        }
        gas = self.w3h.web3.eth.estimateGas(tx)
        tx["gas"] = gas
        return self.w3h.eth_call(tx)

    def call(self, private_key, _data, **kwargs):
        '''Execute TX'''
        addr = self.w3h.web3.eth.account.privateKeyToAccount(private_key).address
        tx = {
            "value": 0,
            "to": self.contract_addr,
            "data": _data,
            "from": addr,
            "gasPrice": self.w3h.web3.eth.gasPrice
        }
        LOG.debug(tx)
        gas = self.w3h.web3.eth.estimateGas(tx)
        tx["gas"] = gas
        tx['nonce'] = self.w3h.get_nonce_for_next_transaction(addr)
        timeout = kwargs.get("timeout", 60)

        return self.w3h.execute_and_wait_for_transaction(private_key, tx, timeout=timeout)

    def __getattr__(self, name):
        if name in self.attrs:
            attr = self.attrs[name]
            return Funcall(self, attr)
        return None

    def get_logs(self, event, _from, count=1, timeout=120):
        '''Filter log and decode'''
        event_type = event.replace("i:", "")
        curr_block = self.w3h.get_block()['number']
        event_signature = '0x%s' % hexlify(eth_utils.keccak(event_type.encode())).decode()
        event_filter = {
            "address": self.contract_addr,
            "topics": [event_signature],
            "fromBlock": hex(_from),
            "toBlock": hex(curr_block)
        }
        results = []
        while len(results) < count and timeout > 0:
            logs = self.w3h.eth.getLogs(event_filter)
            for log in logs:
                results.append((Funcall.decode_log(event, log), log))
                if len(results) >= count:
                    return results
            time.sleep(5)
            timeout -= 5
            event_filter['fromBlock'] = hex(curr_block + 1)
            curr_block = self.w3h.get_block()['number']
            event_filter['toBlock'] = hex(curr_block)
        return results

    def watch(self, events, _from, timeout=120):
        '''Filter log and decode'''
        topics = []
        for event in events:
            event_type = event.replace("i:", "")
            topics.append('0x%s' % hexlify(eth_utils.keccak(event_type.encode())).decode())
        curr_block = self.w3h.get_block()['number']
        event_filter = {
            "address": self.contract_addr,
            "topics": topics,
            "fromBlock": hex(_from),
            "toBlock": hex(curr_block)
        }
        results = []
        while not results and timeout > 0:
            logs = self.w3h.eth.getLogs(event_filter)
            for log in logs:
                results.extend(Funcall.decode_logs(events, log), log)
                if results:
                    return results
            time.sleep(5)
            timeout -= 5
            event_filter['fromBlock'] = hex(curr_block + 1)
            curr_block = self.w3h.get_block()['number']
            event_filter['toBlock'] = hex(curr_block)
        return results