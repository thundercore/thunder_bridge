'''Cross Chain Asset related smart contracts'''

# pylint: disable=unused-import
from example.python.utils.w3helper import SmartContract, W3Helper, Web3

# pylint: disable=unsubscriptable-object
class ERC20(SmartContract):
    '''ERC20 Token methods'''

    def __init__(self, w3h, contract_addr):
        super().__init__(w3h, contract_addr)
        self.attrs.update({
            'name': "name()string",
            'symbol': "symbol()string",
            'decimals': "decimals()uint8",
            'total_supply': "totalSupply()uint256",
            'balance_of': "balanceOf(address)uint256",
            'allowance': "allowance(address,address)uint256",
            'transfer': ("transfer(address,uint256)", True, [
                'Transfer(i:address,i:address,uint256)']),
            'approve': "approve(address,uint256)",
            'transfer_from': "transferFrom(address,address,uint256)",
        })

class ERC677(ERC20):
    '''ECR677 Token'''

    def __init__(self, w3h, contract_addr):
        super().__init__(w3h, contract_addr)
        self.attrs.update({
            'transfer_call': ("transferAndCall(address,uint256,bytes)", False, [
                'Transfer(i:address,i:address,uint256)',
                'Burn(i:address,uint256)',
                'UserRequestForSignature(address,uint256)',
                'Transfer(i:address,i:address,uint256,bytes)']),
            'get_rules': "getFundingRules()(uint256,uint256,uint256,uint256)",
            'owner': "owner()address",
        })

class Validators(SmartContract):
    '''Bridge Validators'''

    def __init__(self, w3h, contract_addr):
        super().__init__(w3h, contract_addr)
        self.attrs.update({
            'owner': "owner()address",
            'required_signatures': "requiredSignatures()uint256",
            'count': "validatorCount()uint256",
            'list': "validatorsList()address[]",
            'set_required_signatures': "setRequiredSignatures(uint256)",
            'add': "addValidator(address)",
            'remove': "removeValidator(address)"
        })

class Bridge(SmartContract):
    '''Bridge Contact'''

    def __init__(self, w3h, contract_addr):
        super().__init__(w3h, contract_addr)
        self.attrs.update({
            'owner': "owner()address",
            'required_signatures': "requiredSignatures()uint256",
            # Fee Manager
            'fee_percent': "feePercent()uint256",
            'fee_subtract': "subtractFee(uint256)uint256",
            'set_fee_percent': "setFeePercent(uint256)",
            # Basic Bridge
            'daily_limit': "dailyLimit()uint256",
            'set_daily_limit': "setDailyLimit(uint256)",
            'exec_daily_limit': "executionDailyLimit()uint256",
            'set_exec_daily_limit': "setExecutionDailyLimit(uint256)",
            'get_current_day': "getCurrentDay()uint256",
            'total_spent_per_day': "totalSpentPerDay(uint256)uint256",
            'total_exec_per_day': "totalExecutedPerDay(uint256)uint256",
            'within_limit': "withinLimit(uint256)bool",
            'within_exec_limit': "withinExecutionLimit(uint256)bool",
            'min_per_tx': "minPerTx()uint256",
            'max_per_tx': "maxPerTx()uint256",
            'set_min_per_tx': "setMinPerTx(uint256)",
            'set_max_per_tx': "setMaxPerTx(uint256)",
            'claim_tokens': "claimTokens(address,address)",
            # Home bridge
            'set_rules': "setFundingRules(uint256,uint256,uint256,uint256)",
            # OverdrawManagerment
            'fix_assets': ("fixAssetsAboveLimits(bytes32,bool)", False,
                           'UserRequestForSignature(address,uint256)'),
            # Contracts
            'validatorContract': "validatorContract()address",
            'erc677token': "erc677token()address",
            'erc20token': "erc20token()address",
            # Events
            'signed_affirm': "event:SignedForAffirmation(i:address,bytes32)", # HOME - in
            'affirm_completed': "event:AffirmationCompleted(address,uint256,bytes32)", # HOME -in
            'amount_limit': "AmountLimitExceeded(address,uint256,bytes32)", # HOME - in
            'signed_request': "event:SignedForUserRequest(i:address,bytes32)", # HOME - out
            'relayed_msg': "event:RelayedMessage(address,uint256,bytes32)" # Foreign - in
        })

    def validators(self):
        '''call validatorContract'''
        return Validators(self.w3h, self.validatorContract())

    #Basic Bridge
    def erc677(self):
        '''call erc677token'''
        return ERC677(self.w3h, self.erc677token())

    def erc20(self):
        '''call erc20token'''
        return ERC20(self.w3h, self.erc20token())