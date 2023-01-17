#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir -p flats/erc20_to_erc20

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/HomeBridgeErcToErcWithFee.sol > flats/erc20_to_erc20/HomeBridgeErcToErcWithFee.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/HomeBridgeErcToErcWithFeeV2.sol > flats/erc20_to_erc20/HomeBridgeErcToErcWithFeeV2.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/ForeignBridgeErcToErcV2.sol > flats/erc20_to_erc20/ForeignBridgeErcToErcV2.sol

./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/BridgeValidators.sol > flats/BridgeValidators_flat.sol
./node_modules/.bin/truffle-flattener contracts/ERC677InitializableBridgeToken.sol > flats/ERC677InitializableBridgeToken.sol
./node_modules/.bin/truffle-flattener contracts/ERC677InitializableBridgeTokenV2.sol > flats/ERC677InitializableBridgeTokenV2.sol
./node_modules/.bin/truffle-flattener contracts/ERC677InitializableToken.sol > flats/ERC677InitializableToken.sol
./node_modules/.bin/truffle-flattener contracts/ERC677MultiBridgeToken.sol > flats/ERC677MultiBridgeToken.sol
./node_modules/.bin/truffle-flattener contracts/ERC677MultiBridgeTokenV2.sol > flats/ERC677MultiBridgeTokenV2.sol
./node_modules/.bin/truffle-flattener contracts/MinterBurnerProxy.sol > flats/MinterBurnerProxy.sol
./node_modules/.bin/truffle-flattener contracts/TokenProxy.sol > flats/TokenProxy.sol
