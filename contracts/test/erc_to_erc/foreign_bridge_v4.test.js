const { expect } = require("chai");

const ForeignBridgeV4 = artifacts.require("ForeignBridgeErcToErcV4.sol");
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");

const halfEther = web3.utils.toBN(web3.utils.toWei('0.5', "ether"));
const requireBlockConfirmations = 8;
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = web3.utils.toBN(web3.utils.toWei('1', "ether"));
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const maxPerTx = halfEther
const FEE_PERCENT = '500'; // 5%

contract('ForeignBridgeV4', async (accounts) => {
    let validatorContract, authorities, owner, token;
    before(async () => {
      validatorContract = await BridgeValidators.new()
      authorities = [accounts[1], accounts[2]];
      owner = accounts[0]
      await validatorContract.initialize(1, authorities, owner)
    })

    it('can claim bridge token', async () => {
        const owner = accounts[0];
        token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
        const foreignBridgeImpl = await ForeignBridgeV4.new();
        const storageProxy = await EternalStorageProxy.new();
        await storageProxy.upgradeTo('1', foreignBridgeImpl.address);
        const foreignBridge = await ForeignBridgeV4.at(storageProxy.address);
        const fallbackRecipient = accounts[7]
        await foreignBridge.initialize(validatorContract.address, token.address, requireBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, FEE_PERCENT, fallbackRecipient);

        await token.mint(accounts[0], halfEther);
        expect((await token.balanceOf(accounts[0])).toString()).to.equal(halfEther.toString())
        await token.transfer(foreignBridge.address, halfEther);
        expect((await token.balanceOf(accounts[0])).toString()).to.equal('0');
        expect((await token.balanceOf(foreignBridge.address)).toString()).to.equal(halfEther.toString());
        await foreignBridge.claimTokens(token.address, accounts[3], {from: owner});
        expect((await token.balanceOf(foreignBridge.address)).toString()).to.equal('0');
        expect((await token.balanceOf(accounts[3])).toString()).to.equal(halfEther.toString());
    });
});
