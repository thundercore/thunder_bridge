const HOME_NATIVE_TO_ERC_ABI = require('../abis/HomeBridgeNativeToErc.abi')
const FOREIGN_NATIVE_TO_ERC_ABI = require('../abis/ForeignBridgeNativeToErc.abi')
const HOME_ERC_TO_ERC_ABI = require('../abis/HomeBridgeErcToErc.abi')
const FOREIGN_ERC_TO_ERC_ABI = require('../abis/ForeignBridgeErc677ToErc677.abi')
const HOME_ERC_TO_NATIVE_ABI = require('../abis/HomeBridgeErcToNative.abi')
const FOREIGN_ERC_TO_NATIVE_ABI = require('../abis/ForeignBridgeErcToNative.abi')

const BRIDGE_MODES = {
  NATIVE_TO_ERC: 'NATIVE_TO_ERC',
  ERC_TO_ERC: 'ERC_TO_ERC',
  ERC_TO_NATIVE: 'ERC_TO_NATIVE'
}

const ERC_TYPES = {
  ERC20: 'ERC20',
  ERC677: 'ERC677'
}

function getBridgeABIs(bridgeMode=undefined) {
  let HOME_ABI = HOME_ERC_TO_ERC_ABI
  let FOREIGN_ABI = FOREIGN_ERC_TO_ERC_ABI

  return { HOME_ABI, FOREIGN_ABI }
}

function decodeBridgeMode(bridgeMode) {
  return BRIDGE_MODES[bridgeMode]
}

module.exports = {
  decodeBridgeMode,
  getBridgeABIs,
  BRIDGE_MODES,
  ERC_TYPES
}
