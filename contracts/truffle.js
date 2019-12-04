const HDWalletProvider = require('truffle-hdwallet-provider');
const fs = require('fs');
const JSON5 = require('json5');

let infuraProjectId = null, infuraProjectSecret = null;
try {
  const localConfStr = fs.readFileSync('local.jsonc', { encoding: 'utf8' });
  const localConf = JSON5.parse(localConfStr);
  let t = localConf['infura_project_id'];
  if (t) {
    infuraProjectId = t;
  }
  t = localConf['infura_project_secret'];
  if (t) {
    infuraProjectSecret = t;
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    throw err;
  }
}

let privateKeys;
try {
  privateKeys = fs.readFileSync('.private-keys', {encoding: 'ascii'}).split('\n').filter(x => x.length > 0);
} catch (err) {
  if (err.code === 'ENOENT') {
    privateKeys = null;
  } else {
    throw err;
  }
}

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*",
      gasPrice: 1000000000
    },
    test: {
      host: "localhost",
      port: 7545,
      network_id: "*",
      gasPrice: 1000000000
    },
	  /*
    kovan: {
      host: "localhost",
      port: "8591",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    },*/
    kovan: {
      provider: () => {
        if (privateKeys === null) {
          throw (new Error('Create a .private-keys file'));
        }
        if (infuraProjectId === null) {
          throw (new Error('Set "infura_project_id" in local.jsonc'));
        }
        if (infuraProjectSecret === null) {
          throw (new Error('Set "infura_project_secret" in local.jsonc'));
        }
        // FIXME: infuraProjectSecret not used yet
        return new HDWalletProvider(privateKeys, `https://kovan.infura.io/v3/${infuraProjectId}`, 0 /*address_index*/,
          privateKeys.length/*num_address*/);
      },
      network_id: 42
    },

    core: {
      host: "localhost",
      port: "8777",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    },
    sokol: {
      host: "localhost",
      port: "8545",
      network_id: "*",
      gas: 4700000,
      gasPrice: 1000000000
    },
    coverage: {
      host: 'localhost',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gasPrice: 1000000000
    },
    'thunder-mainnet': {
      provider: () => {
        if (privateKeys === null) {
          throw (new Error('Create a .private-keys file'));
        }
        return new HDWalletProvider(privateKeys, 'https://mainnet-rpc.thundercore.com', 0 /*address_index*/, privateKeys.length/*num_addresses*/);
      },
      network_id: '108',
    },
    'thunder-venus': {
      provider: () => {
        if (privateKeys === null) {
          throw (new Error('Create a .private-keys file'));
        }
        return new HDWalletProvider(privateKeys, 'https://venus-rpc.thundercore.com', 0 /*address_index*/, privateKeys.length/*num_addresses*/);
      },
      network_id: '18',
    },
  },
  compilers: {
    solc: {
      version: "0.4.24",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      gasPrice: 1
    }
  }
};
