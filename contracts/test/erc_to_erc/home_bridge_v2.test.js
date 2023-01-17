// contract import
const HomeBridgeErcToErcWithFeeV2 = artifacts.require(
  "HomeBridgeErcToErcWithFeeV2.sol"
);
const MinterBurnerProxy = artifacts.require("MinterBurnerProxy.sol");
const ERC677MultiBridgeTokenV2 = artifacts.require(
  "ERC677MultiBridgeTokenV2.sol"
);
const BridgeValidators = artifacts.require("BridgeValidators.sol");

// helper import
const { expect } = require("chai");
const Web3Utils = require("web3-utils");
const { ERROR_MSG, toBN } = require("../setup");
const { expectEventInLogs, ether } = require("../helpers/helpers");

// constant declare
const minPerTx = ether("0.01");
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei("1", "gwei");
const oneEther = ether("1");
const halfEther = ether("0.5");
const foreignDailyLimit = oneEther;
const foreignMaxPerTx = halfEther;
const FEE_PERCENT = "500"; // 5%
const ZERO = toBN(0);
const markedAsProcessed = toBN(2)
  .pow(toBN(255))
  .add(toBN(1));

// test onTokenTransfer and executeAffirmation function that uses minterBurner
contract("HomeBridgeErcToErcWithFeeV2", async accounts => {
  describe("#onTokenTransfer", async () => {
    let homeBridge, validatorContract, owner, token, authorities, minterBurner;
    let user;
    beforeEach(async () => {
      const feePercent = 0;
      validatorContract = await BridgeValidators.new();
      authorities = [accounts[1]];
      owner = accounts[0];
      user = accounts[2];
      await validatorContract.initialize(1, authorities, owner);
      homeBridge = await HomeBridgeErcToErcWithFeeV2.new();
      token = await ERC677MultiBridgeTokenV2.new("Test ERC677", "TEST", 18);
      await homeBridge.initialize(
        validatorContract.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        feePercent
      );
      minterBurner = await MinterBurnerProxy.new();
      await minterBurner.initialize(token.address, homeBridge.address);
      // add bridge contract to token's whitelist to trigger onTokenTransfer callback
      await token.addBridgeContract(homeBridge.address);
      await token.mint(user, oneEther);
      await minterBurner.setThunderBridgeSupply(oneEther);
      await token.transferOwnership(minterBurner.address);
      await homeBridge.setMinterBurner(minterBurner.address);
    });

    it("can burn token correctly with burner", async () => {
      let beforeBalance = await token.totalSupply();
      await token.transfer(homeBridge.address, halfEther, {
        from: user
      }).should.be.fulfilled;

      // should burn half ether
      beforeBalance
        .sub(halfEther)
        .should.be.bignumber.equal(await token.totalSupply());
      beforeBalance
        .sub(halfEther)
        .should.be.bignumber.equal(await minterBurner.thunderBridgeSupply());

      // should burn all token in bridge contract
      ZERO.should.be.bignumber.equal(await token.balanceOf(homeBridge.address));
    });
    it("does not modify thunder bridge supply when burn by other operator", async () => {
      let homeBridge2 = await HomeBridgeErcToErcWithFeeV2.new();
      await homeBridge2.initialize(
        validatorContract.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        0
      );
      await homeBridge2.setMinterBurner(minterBurner.address);
      await minterBurner.addOperator(homeBridge2.address);

      // add homeBridge2 to token's whitelist to trigger onTokenTransfer callback
      const data = token.contract.methods
        .addBridgeContract(homeBridge2.address)
        .encodeABI();
      await minterBurner.callToken(data).should.be.fulfilled;

      let beforeBalance = await token.totalSupply();
      await token.transfer(homeBridge2.address, halfEther, {
        from: user
      }).should.be.fulfilled;

      // 0.5 ether is burned, but thunder bridge supply should not be modified
      beforeBalance
        .sub(halfEther)
        .should.be.bignumber.equal(await token.totalSupply());
      beforeBalance.should.be.bignumber.equal(
        await minterBurner.thunderBridgeSupply()
      );
    });
  });

  describe("#executeAffirmation", async () => {
    let homeBridge, validatorContract, owner, token, authorities, minterBurner;

    beforeEach(async () => {
      const feePercent = 0;
      validatorContract = await BridgeValidators.new();
      authorities = [accounts[1]];
      owner = accounts[0];
      await validatorContract.initialize(1, authorities, owner);
      homeBridge = await HomeBridgeErcToErcWithFeeV2.new();
      token = await ERC677MultiBridgeTokenV2.new("Test ERC677", "TEST", 18);
      await homeBridge.initialize(
        validatorContract.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        feePercent
      );
      minterBurner = await MinterBurnerProxy.new();
      await minterBurner.initialize(token.address, homeBridge.address);
      await token.transferOwnership(minterBurner.address);
      await homeBridge.setMinterBurner(minterBurner.address);
    });

    it("should allow validator to withdraw", async () => {
      const recipient = accounts[5];
      const value = halfEther;
      const balanceBefore = await token.balanceOf(recipient);
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authorities[0] }
      );
      expectEventInLogs(logs, "SignedForAffirmation", {
        signer: authorities[0],
        transactionHash
      });
      expectEventInLogs(logs, "AffirmationCompleted", {
        recipient,
        value,
        transactionHash
      });

      const totalSupply = await token.totalSupply();
      const balanceAfter = await token.balanceOf(recipient);
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value));
      totalSupply.should.be.bignumber.equal(value);

      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);
      const senderHash = Web3Utils.soliditySha3(authorities[0], msgHash);
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash));
      markedAsProcessed.should.be.bignumber.equal(
        await homeBridge.numAffirmationsSigned(msgHash)
      );
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: authorities[0]
        })
        .should.be.rejectedWith(ERROR_MSG);
    });

    it("test with 2 signatures required", async () => {
      let token2sig = await ERC677MultiBridgeTokenV2.new(
        "Some ERC20",
        "RSZT",
        18
      );
      let validatorContractWith2Signatures = await BridgeValidators.new();
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0];
      const feePercent = 0;
      await validatorContractWith2Signatures.initialize(
        2,
        authoritiesTwoAccs,
        ownerOfValidators
      );
      let homeBridgeWithTwoSigs = await HomeBridgeErcToErcWithFeeV2.new();
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token2sig.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        feePercent
      );
      let minterBurner2sig = await MinterBurnerProxy.new();
      await minterBurner2sig.initialize(
        token2sig.address,
        homeBridgeWithTwoSigs.address
      );
      await token2sig.transferOwnership(minterBurner2sig.address);
      await homeBridgeWithTwoSigs.setMinterBurner(minterBurner2sig.address);

      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await token2sig.balanceOf(recipient);
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesTwoAccs[0] }
      ).should.be.fulfilled;
      expectEventInLogs(logs, "SignedForAffirmation", {
        signer: authorities[0],
        transactionHash
      });

      expect(await token2sig.totalSupply()).to.be.bignumber.equal(ZERO);
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(
        msgHash
      );
      notProcessed.should.be.bignumber.equal(toBN(1));

      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesTwoAccs[0]
        })
        .should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesTwoAccs[1] }
      ).should.be.fulfilled;

      const balanceAfter = await token2sig.balanceOf(recipient);
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value));

      expectEventInLogs(secondSignature.logs, "AffirmationCompleted", {
        recipient,
        value,
        transactionHash
      });

      const senderHash = Web3Utils.soliditySha3(authoritiesTwoAccs[0], msgHash);
      true.should.be.equal(
        await homeBridgeWithTwoSigs.affirmationsSigned(senderHash)
      );

      const senderHash2 = Web3Utils.soliditySha3(
        authoritiesTwoAccs[1],
        msgHash
      );
      true.should.be.equal(
        await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2)
      );

      const processed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2));
      expect(
        await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      ).to.be.bignumber.equal(processed);
    });
    it("should not allow to double submit", async () => {
      const recipient = accounts[5];
      const value = "1";
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled;
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: authorities[0]
        })
        .should.be.rejectedWith(ERROR_MSG);
    });

    it("should not allow non-authorities to execute deposit", async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: accounts[7]
        })
        .should.be.rejectedWith(ERROR_MSG);
    });

    it("doesnt allow to deposit if requiredSignatures has changed", async () => {
      let token2sig = await ERC677MultiBridgeTokenV2.new(
        "Some ERC20",
        "RSZT",
        18
      );
      let validatorContractWith2Signatures = await BridgeValidators.new();
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0];
      const feePercent = 0;
      await validatorContractWith2Signatures.initialize(
        2,
        authoritiesTwoAccs,
        ownerOfValidators
      );
      let homeBridgeWithTwoSigs = await HomeBridgeErcToErcWithFeeV2.new();
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token2sig.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        feePercent
      );
      let minterBurner2sig = await MinterBurnerProxy.new();
      await minterBurner2sig.initialize(
        token2sig.address,
        homeBridgeWithTwoSigs.address
      );
      await token2sig.transferOwnership(minterBurner2sig.address);
      await homeBridgeWithTwoSigs.setMinterBurner(minterBurner2sig.address);

      const recipient = accounts[5];
      const value = halfEther.div(toBN(2));
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await token2sig.balanceOf(recipient);

      await homeBridgeWithTwoSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesTwoAccs[0] }
      ).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesTwoAccs[1] }
      ).should.be.fulfilled;
      balanceBefore
        .add(value)
        .should.be.bignumber.equal(await token2sig.balanceOf(recipient));
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be
        .fulfilled;
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesTwoAccs[2]
        })
        .should.be.rejectedWith(ERROR_MSG);
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be
        .fulfilled;
      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, {
          from: authoritiesTwoAccs[2]
        })
        .should.be.rejectedWith(ERROR_MSG);
      balanceBefore
        .add(value)
        .should.be.bignumber.equal(await token2sig.balanceOf(recipient));
    });
    it("works with 5 validators and 3 required signatures", async () => {
      const recipient = accounts[8];
      const authoritiesFiveAccs = [
        accounts[1],
        accounts[2],
        accounts[3],
        accounts[4],
        accounts[5]
      ];
      let ownerOfValidators = accounts[0];
      const validatorContractWith3Signatures = await BridgeValidators.new();
      await validatorContractWith3Signatures.initialize(
        3,
        authoritiesFiveAccs,
        ownerOfValidators
      );
      token = await ERC677MultiBridgeTokenV2.new("Some ERC20", "RSZT", 18);

      const homeBridgeWithThreeSigs = await HomeBridgeErcToErcWithFeeV2.new();
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        oneEther,
        halfEther,
        minPerTx,
        gasPrice,
        requireBlockConfirmations,
        token.address,
        foreignDailyLimit,
        foreignMaxPerTx,
        owner,
        FEE_PERCENT
      );
      let minterBurner = await MinterBurnerProxy.new();
      await minterBurner.initialize(
        token.address,
        homeBridgeWithThreeSigs.address
      );
      await token.transferOwnership(minterBurner.address);
      await homeBridgeWithThreeSigs.setMinterBurner(minterBurner.address);

      const value = web3.utils.toBN(web3.utils.toWei("0.5", "ether"));
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const {
        logs
      } = await homeBridgeWithThreeSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesFiveAccs[0] }
      ).should.be.fulfilled;
      expectEventInLogs(logs, "SignedForAffirmation", {
        signer: authorities[0],
        transactionHash
      });

      await homeBridgeWithThreeSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesFiveAccs[1] }
      ).should.be.fulfilled;
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authoritiesFiveAccs[2] }
      ).should.be.fulfilled;

      expectEventInLogs(thirdSignature.logs, "AffirmationCompleted", {
        recipient,
        value,
        transactionHash
      });
    });
    it("should not allow execute affirmation over foreign max tx limit", async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs, "AmountLimitExceeded", {
        recipient,
        value,
        transactionHash
      });
    });
    it("should fail if txHash already set as above of limits", async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs, "AmountLimitExceeded", {
        recipient,
        value,
        transactionHash
      });

      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, {
          from: authorities[0]
        })
        .should.be.rejectedWith(ERROR_MSG);
      await homeBridge
        .executeAffirmation(accounts[6], value, transactionHash, {
          from: authorities[0]
        })
        .should.be.rejectedWith(ERROR_MSG);
    });
    it("should not allow execute affirmation over daily foreign limit", async () => {
      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash =
        "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs, "SignedForAffirmation", {
        signer: authorities[0],
        transactionHash
      });

      expectEventInLogs(logs, "AffirmationCompleted", {
        recipient,
        value,
        transactionHash
      });

      const transactionHash2 =
        "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const { logs: logs2 } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash2,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs2, "SignedForAffirmation", {
        signer: authorities[0],
        transactionHash: transactionHash2
      });

      expectEventInLogs(logs2, "AffirmationCompleted", {
        recipient,
        value,
        transactionHash: transactionHash2
      });

      const transactionHash3 =
        "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const { logs: logs3 } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash3,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs3, "AmountLimitExceeded", {
        recipient,
        value,
        transactionHash: transactionHash3
      });

      const outOfLimitAmount = await homeBridge.outOfLimitAmount();

      outOfLimitAmount.should.be.bignumber.equal(halfEther);

      const transactionHash4 =
        "0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196";
      const { logs: logs4 } = await homeBridge.executeAffirmation(
        recipient,
        value,
        transactionHash4,
        { from: authorities[0] }
      ).should.be.fulfilled;

      expectEventInLogs(logs4, "AmountLimitExceeded", {
        recipient,
        value,
        transactionHash: transactionHash4
      });

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount();
      newOutOfLimitAmount.should.be.bignumber.equal(oneEther);
    });
  });
});
