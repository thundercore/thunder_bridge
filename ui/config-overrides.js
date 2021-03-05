const { addDecoratorsLegacy, disableEsLint, override } = require('customize-cra')
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

const publicPathPlugin = () => config => {   
  if (process.env.NODE_ENV === "development") return config                                                                                                                                                                        
  config.output.publicPath = `/${process.env.REACT_APP_BRIDGE_TYPE.toLowerCase()}`;                                                                                                                                                                              
  return config;                                                                                                                                                                                                  
};   

const disableModuleScopePlugin = () => config => {
  config.resolve.plugins = config.resolve.plugins.filter(
    plugin => !(plugin instanceof ModuleScopePlugin)
  )
  return config
}

module.exports = override(publicPathPlugin(), addDecoratorsLegacy(), disableEsLint(), disableModuleScopePlugin())
