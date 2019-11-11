# Truffle Console Instructions
In `local.jsonc`:
```
{
  "infura_project_id": "...",
  "infura_project_secret": "...",
}
```

In `.private-keys`:
```
1b9a85a7584d44b8948ca9e3ad27e6f2cb31279905a94a7a9363889964b22e46
```

# Bridge Smart Contracts
These contracts provide the core functionality for the Bridge. They implement the logic to relay assests between two EVM-based blockchain networks. The contracts collect bridge validator's signatures to approve and facilitate relay operations.

## Bridge Overview

The Bridge allows users to transfer assets between two chains in the Ethereum ecosystem.

## Bridge Smart Contracts Summary

### Operations

Currently, the contracts support two types of relay operations:
* Tokenize the native coin in one blockchain network (Home) into an ERC20 token in another network (Foreign).
* Swap a token presented by an existing ERC20 contract in a Foreign network into an ERC20 token in the Home network, where one pair of bridge contracts corresponds to one pair of ERC20 tokens.
* to mint new native coins in Home blockchain network from a token presented by an existing ERC20 contract in a Foreign network.


### Components

The bridge contracts consist of several components:
* The **Home Bridge** smart contract. This is currently deployed in Home chain.
* The **Foreign Bridge** smart contract. This is usually deployed in the Ethereum Mainnet.
* Depending on the type of relay operations the following components are also used:
  * in `ERC-TO-ERC` mode: the ERC20 token (in fact, the ERC677 extension is used) is deployed on the Home network;
* The **Validators** smart contract is deployed in both the chains.

### Bridge Roles and Responsibilities

Responsibilities and roles of the bridge:
- **Administrator** role (representation of a multisig contract):
  - add/remove validators
  - set daily limits on both bridges
  - set maximum per transaction limit on both bridges
  - set minimum per transaction limit on both bridges
  - upgrade contracts in case of vulnerability
  - set minimum required signatures from validators in order to relay a user's transaction
- **Validator** role:
  - provide 100% uptime to relay transactions
  - listen for `UserRequestForSignature` events on Home Bridge and sign an approval to relay assets on Foreign network
  - listen for `CollectedSignatures` events on Home Bridge. As soon as enough signatures are collected, transfer all collected signatures to the Foreign Bridge contract.
  - listen for `Transfer` events on the Foreign Bridge and send approval to Home Bridge to relay assets from Foreign Network to Home
- **User** role:
  - sends assets to Bridge contracts:
    - in `ERC-TO-ERC` mode: transfer ERC20 tokens to the Foreign Bridge to mint ERC20 tokens on the Home Network, transfer ERC20 tokens to the Home Bridge to unlock ERC20 tokens on Foreign networks;

## Deploy

Go to [deployment](./deployment) folder and follow instructions in **Contracts** section.

#### Test
```bash
npm install
npm test
```

#### Flatten
Fattened contracts can be used to verify the contract code in a block explorer like BlockScout or Etherscan.
The following command will prepare flattened version of the contracts:

```bash
npm run flatten
```
The flattened contracts can be found in the `flats` directory.

## License

[![License: GPL v3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.



