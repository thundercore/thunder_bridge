'''
Cross Chain Asset Tests
USDT <-> TT-USDT
DAI  <-> TT-DAI
'''

import os
import sys
import time
import logging
from pprint import pformat
from hexbytes import HexBytes

from example.python.lib.testcase import TestBase, testmain
from example.python.lib.processpool import ProcessPool
from example.python.contracts import Bridge, W3Helper, Web3, ERC20, ERC677

LOG = logging.getLogger(__name__)

class ChainAssetTest(TestBase):
    '''Cross Chain Asset Test'''

    @classmethod
    def setup_parser(cls):
        parser = super().setup_parser()
        parser.add_argument('--token', default = "usdt", help = 'usdt or dai')
        return parser

    @classmethod
    def setUpClass(cls):
        cls.config = cls.load_json(
            os.path.abspath(os.path.join(os.path.dirname(__file__), "env.json")))
        super().setUpClass()

        cls.w3h_h = W3Helper(cls.config[cls.ARGS.token]['h_rpc'])
        cls.w3h_f = W3Helper(cls.config[cls.ARGS.token]['f_rpc'])
        cls.bridge_h = Bridge(cls.w3h_h, cls.config[cls.ARGS.token]['h_bridge'])
        cls.bridge_f = Bridge(cls.w3h_f, cls.config[cls.ARGS.token]['f_bridge'])
        cls.token_h = cls.bridge_h.erc677()
        cls.token_f = cls.bridge_f.erc20()
        cls.validators_h = cls.bridge_h.validators()
        cls.validators_f = cls.bridge_f.validators()
        cls.decimals = cls.token_f.decimals()

    ''' Test Parallel Transfer '''
    def test_01_parallel(self):
        # Private key list of wallets
        # pkeys = ['Key A',
        #          'Key B']

        def _fill_tokens():
            decimals = self.token_f.decimals()
            for private_key in pkeys:
                addr = self.token_f.w3h.web3.eth.account.privateKeyToAccount(private_key).address
                balance = self.token_f.balance_of(addr)
        _fill_tokens()
        hb_addr = self.bridge_h.contract_addr
        fb_addr = self.bridge_f.contract_addr
        ht_addr = self.token_h.contract_addr
        ft_addr = self.token_f.contract_addr
        h_url = self.config[self.ARGS.token]['h_rpc']
        f_url = self.config[self.ARGS.token]['f_rpc']
        hfee_percent = self.bridge_h.fee_percent()
        ffee_percent = self.bridge_f.fee_percent()

        self.log.info("========= Run Parallel Tests =========")
        times = len(pkeys)
        pool = ProcessPool(times)

        for i in range(times):
            addr = self.token_f.w3h.web3.eth.account.privateKeyToAccount(pkeys[i]).address
            pool.add_task(_test_parallel, i, h_url, f_url, ht_addr, ft_addr, hb_addr, fb_addr,
                          hfee_percent, ffee_percent, addr, pkeys[i])
        results = pool.wait_completion()
        self.log.info("Test Results:\n%s", pformat(results))


def _test_parallel(i, h_url, f_url, ht_addr, ft_addr, hb_addr, fb_addr, hfee, ffee, acc, key):
    LOG.info("Run parallel work: %s - %s", i, acc)
    w3h_h = W3Helper(h_url)
    w3h_f = W3Helper(f_url)
    token_h = ERC677(w3h_h, ht_addr)
    token_f = ERC20(w3h_f, ft_addr)
    decimals = token_f.decimals()

    def _test_para(i, f2h, s_token, d_token, src_acc, dst_acc, src_key, amount):
        '''Test Token Transfer Cross Chain'''
        s_src_b = s_token.balance_of(src_acc)
        d_dst_b = d_token.balance_of(dst_acc)

        LOG.info("Src account balance - %s: %s", i, s_src_b)
        LOG.info("Dst account balance - %s: %s", i, d_dst_b)

        if (s_src_b < amount):
            LOG.info("Balance of source account is lower than the amount to transfer.")
            return 'Error'

        if f2h:
            extra_data = '0x000000000000000000000000%s' % dst_acc[2:]
            LOG.info("%s", token_f.transfer(src_key, fb_addr, amount, extra_data))
        else:
            if amount < 1 * 10 ** decimals:
                LOG.info("Amount to transfer is lower than 1 unit.")
                return 'Error'
            extra_data = HexBytes.fromhex('000000000000000000000000%s' % dst_acc[2:])
            LOG.info("%s", token_h.transfer_call(src_key, hb_addr, amount, bytes(extra_data)))
        time.sleep(30)

        s_src_a = s_token.balance_of(src_acc)
        d_dst_a = d_token.balance_of(dst_acc)
        LOG.info("Src account balance - %s: %s", i, s_src_a)
        LOG.info("Dst account balance - %s: %s", i, d_dst_a)

        fee = 0
        if f2h:
            fee = hfee * amount / 10000
        else:
            fee = ffee * amount / 10000
        return s_src_b - s_src_a == amount and d_dst_a - d_dst_b == amount - fee

    amount_to_transfer = int(1 * 10 ** decimals)

    #res1 = _test_para("%s H->F" % i, False, token_h, token_f, acc, acc, key, amount_to_transfer)
    res1 = _test_para("%s F->H" % i, True, token_f, token_h, acc, acc, key, amount_to_transfer)

    return res1

if __name__ == '__main__':
    sys.exit(testmain(ChainAssetTest))