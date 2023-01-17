const MinterBurnerProxy = artifacts.require("MinterBurnerProxy.sol");
const ERC677MultiBridgeToken = artifacts.require(
  "ERC677MultiBridgeTokenV2.sol"
);

const { ERROR_MSG } = require("./setup");

const { expect } = require("chai");
const Web3 = require("web3");

contract("MinterBurnerProxy", async accounts => {
  let token;
  let minter;
  beforeEach(async () => {
    token = await ERC677MultiBridgeToken.new("Token", "T1", 18);
    minter = await MinterBurnerProxy.new();

    await minter.initialize(token.address, accounts[0]);
    await token.transferOwnership(minter.address);
  });

  it("can mint from account_0", async () => {
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("10"));
  });

  it("can burn from a address", async () => {
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("5"), {
      from: accounts[0]
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("5"));
  });

  it("can mint from operator", async () => {
    let operator = accounts[1];
    let account = web3.eth.accounts.create();

    await minter.addOperator(operator);
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: operator
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);
    expect(balance.toString()).to.be.equal(Web3.utils.toWei("10"));
  });

  it("can burn from operator", async () => {
    let operator = accounts[1];
    let account = web3.eth.accounts.create();

    await minter.addOperator(operator);
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("5"), {
      from: operator
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);
    expect(balance.toString()).to.be.equal(Web3.utils.toWei("5"));
  });

  it("cannot mint from removed operator", async () => {
    let operator = accounts[1];
    let account = web3.eth.accounts.create();

    await minter.addOperator(operator);
    await minter.removeOperator(operator);
    await minter
      .mint(account.address, Web3.utils.toWei("10"), {
        from: operator
      })
      .should.be.rejectedWith(ERROR_MSG);
  });

  it("cannot burn from removed operator", async () => {
    let operator = accounts[1];
    let account = web3.eth.accounts.create();

    await minter.addOperator(operator);
    await minter.removeOperator(operator);
    await minter
      .burn(account.address, Web3.utils.toWei("10"), {
        from: operator
      })
      .should.be.rejectedWith(ERROR_MSG);
  });

  it("can call token from owner", async () => {
    let owner = await token.owner();
    let account = web3.eth.accounts.create();

    const data = token.contract.methods
      .transferOwnership(account.address)
      .encodeABI();

    await minter.callToken(data).should.be.fulfilled;

    let newOwner = await token.owner();

    expect(owner).to.be.not.equal(newOwner);
  });

  it("can mint within per mint limit", async () => {
    await minter.setPerMintLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    });
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("10"));
  });

  it("can burn within per burn limit", async () => {
    await minter.setPerBurnLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("100"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("100"));
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("0"));
  });

  it("cannot mint beyond per mint limit", async () => {
    await minter.setPerMintLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter
      .mint(account.address, Web3.utils.toWei("101"), {
        from: accounts[0]
      })
      .should.be.rejectedWith(ERROR_MSG);
  });

  it("cannot burn beyond per burn limit", async () => {
    await minter.setPerBurnLimit(web3.utils.toWei("10"));
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("50"), {
      from: accounts[0]
    });
    await minter
      .burn(account.address, Web3.utils.toWei("11"), {
        from: accounts[0]
      })
      .should.be.rejectedWith(ERROR_MSG);
  });

  it("can mint within operator day limit", async () => {
    await minter.setOperatorDailyMintLimit(
      web3.utils.toWei("100"),
      accounts[0]
    );
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("10"));
  });

  it("can burn within operator day limit", async () => {
    await minter.setOperatorDailyBurnLimit(web3.utils.toWei("10"), accounts[0]);
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("50"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter.burn(account.address, Web3.utils.toWei("10"));
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("40"));
  });

  it("cannot mint beyond operator day limit, but new day", async () => {
    await minter.setOperatorDailyMintLimit(
      web3.utils.toWei("100"),
      accounts[0]
    );
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("100"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter
      .mint(account.address, Web3.utils.toWei("1"), {
        from: accounts[0]
      })
      .should.be.rejectedWith("Exceed operator day limit");

    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [2 * 86400],
        id: 0
      },
      () => {}
    );
    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: 0
      },
      () => {}
    );

    await minter.mint(account.address, Web3.utils.toWei("1"), {
      from: accounts[0]
    }).should.be.fulfilled;
  });

  it("cannot burn beyond operator day limit, but new day", async () => {
    await minter.setOperatorDailyBurnLimit(
      web3.utils.toWei("100"),
      accounts[0]
    );
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("150"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("100"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter
      .burn(account.address, Web3.utils.toWei("1"), {
        from: accounts[0]
      })
      .should.be.rejectedWith("Exceed operator day limit");

    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [2 * 86400],
        id: 0
      },
      () => {}
    );
    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: 0
      },
      () => {}
    );

    await minter.burn(account.address, Web3.utils.toWei("1"), {
      from: accounts[0]
    }).should.be.fulfilled;
  });

  it("can mint within total day limit", async () => {
    await minter.setDailyMintLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    }).should.be.fulfilled;
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("10"));
  });

  it("can burn within total day limit", async () => {
    await minter.setDailyMintLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.mint(account.address, Web3.utils.toWei("10"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("5"), {
      from: accounts[0]
    });
    let balance = await token.balanceOf(account.address);

    expect(balance.toString()).to.be.equal(Web3.utils.toWei("5"));
  });

  it("cannot mint beyond total day limit, but new day", async () => {
    await minter.setDailyMintLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.addOperator(accounts[1]);
    await minter.mint(account.address, Web3.utils.toWei("50"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter.mint(account.address, Web3.utils.toWei("50"), {
      from: accounts[1]
    }).should.be.fulfilled;

    await minter
      .mint(account.address, Web3.utils.toWei("1"), {
        from: accounts[1]
      })
      .should.be.rejectedWith("Exceed day limit");

    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [2 * 86400],
        id: 0
      },
      () => {}
    );
    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: 0
      },
      () => {}
    );

    await minter.mint(account.address, Web3.utils.toWei("1"), {
      from: accounts[1]
    }).should.be.fulfilled;
  });

  it("cannot burn beyond total day limit, but new day", async () => {
    await minter.setDailyBurnLimit(web3.utils.toWei("100"));
    let account = web3.eth.accounts.create();
    await minter.addOperator(accounts[1]);
    await minter.mint(account.address, Web3.utils.toWei("200"), {
      from: accounts[0]
    });
    await minter.burn(account.address, Web3.utils.toWei("50"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter.burn(account.address, Web3.utils.toWei("50"), {
      from: accounts[1]
    }).should.be.fulfilled;

    await minter
      .burn(account.address, Web3.utils.toWei("1"), {
        from: accounts[1]
      })
      .should.be.rejectedWith("Exceed day limit");

    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [2 * 86400],
        id: 0
      },
      () => {}
    );
    await web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: 0
      },
      () => {}
    );

    await minter.burn(account.address, Web3.utils.toWei("1"), {
      from: accounts[1]
    }).should.be.fulfilled;
  });

  it("can correctly increase thunder bridge supply", async () => {
    await minter.mint(accounts[0], web3.utils.toWei("100")).should.be.fulfilled;
    let balance = await minter.thunderBridgeSupply();
    expect(balance.toString()).to.be.equal(web3.utils.toWei("100"));
  });

  it("can correctly decrease thunder bridge supply", async () => {
    await minter.mint(accounts[0], web3.utils.toWei("100")).should.be.fulfilled;
    await minter.burn(accounts[0], web3.utils.toWei("50")).should.be.fulfilled;
    let balance = await minter.thunderBridgeSupply();
    expect(balance.toString()).to.be.equal(web3.utils.toWei("50"));
  });

  it("does not increase thunder bridge supply when mint by other operator", async () => {
    await minter.addOperator(accounts[1]);
    await minter.mint(accounts[0], web3.utils.toWei("100"), {
      from: accounts[1]
    }).should.be.fulfilled;
    let balance = await minter.thunderBridgeSupply();
    expect(balance.toString()).to.be.equal(web3.utils.toWei("0"));
  });

  it("does not decrease thunder bridge supply when burn by other operator", async () => {
    await minter.addOperator(accounts[1]);
    await minter.mint(accounts[0], web3.utils.toWei("100"), {
      from: accounts[0]
    }).should.be.fulfilled;
    await minter.burn(accounts[0], web3.utils.toWei("50"), {
      from: accounts[1]
    }).should.be.fulfilled;
    let balance = await minter.thunderBridgeSupply();
    expect(balance.toString()).to.be.equal(web3.utils.toWei("100"));
  });
});
