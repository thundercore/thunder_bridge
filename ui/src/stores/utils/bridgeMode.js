import HOME_ERC_TO_ERC_ABI from '../../../abis/HomeBridgeErcToErcWithFee.abi'
import FOREIGN_ERC_TO_ERC_ABI from '../../../abis/ForeignBridgeErcToErc.abi'

export const bridgeType = process.env.REACT_APP_BRIDGE_TYPE.toLowerCase()

export const BRIDGE_MODES = {
  NATIVE_TO_ERC: 'NATIVE_TO_ERC',
  ERC_TO_ERC: 'ERC_TO_ERC',
  ERC_TO_NATIVE: 'ERC_TO_NATIVE'
}

export const FEE_MANAGER_MODE = {
  ONE_DIRECTION: 'ONE_DIRECTION',
  BOTH_DIRECTIONS: 'BOTH_DIRECTIONS',
  UNDEFINED: 'UNDEFINED'
}

export const ERC_TYPES = {
  ERC677: 'ERC677',
  ERC20: 'ERC20'
}

export const getBridgeABIs = bridgeMode => {
  let HOME_ABI = null
  let FOREIGN_ABI = null
  if (bridgeMode === BRIDGE_MODES.ERC_TO_ERC) {
    HOME_ABI = HOME_ERC_TO_ERC_ABI
    FOREIGN_ABI = FOREIGN_ERC_TO_ERC_ABI
  } else {
    throw new Error(`Unrecognized bridge mode: ${bridgeMode}`)
  }

  return { HOME_ABI, FOREIGN_ABI }
}

export const decodeBridgeMode = bridgeModeHash => {
  switch (bridgeModeHash) {
    case '0x92a8d7fe':
      return BRIDGE_MODES.NATIVE_TO_ERC
    case '0xba4690f5':
      return BRIDGE_MODES.ERC_TO_ERC
    case '0x18762d46':
      return BRIDGE_MODES.ERC_TO_NATIVE
    default:
      throw new Error(`Unrecognized bridge mode hash: '${bridgeModeHash}'`)
  }
}

export const getUnit = bridgeMode => {
  let unitHome = null
  let unitForeign = null
  if (bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC) {
    unitHome = 'Native coins'
    unitForeign = 'Tokens'
  } else if (bridgeMode === BRIDGE_MODES.ERC_TO_ERC) {
    unitHome = 'Tokens'
    unitForeign = 'Tokens'
  } else if (bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE) {
    unitHome = 'Native coins'
    unitForeign = 'Tokens'
  } else {
    throw new Error(`Unrecognized bridge mode: ${bridgeMode}`)
  }

  return { unitHome, unitForeign }
}

export const decodeFeeManagerMode = managerModeHash => {
  switch (managerModeHash) {
    case '0xf2aed8f7':
      return FEE_MANAGER_MODE.ONE_DIRECTION
    case '0xd7de965f':
      return FEE_MANAGER_MODE.BOTH_DIRECTIONS
    default:
      throw new Error(`Unrecognized fee manager mode hash: '${managerModeHash}'`)
  }
}
