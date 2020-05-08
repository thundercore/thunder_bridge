const path = require('path')
const shell = require('shelljs')

const envsDir = path.join(__dirname, 'envs')
const deployContractsDir = path.join(__dirname, 'contracts/deploy')
const erc20ScriptDir = path.join(__dirname, 'scripts')

shell.cp(path.join(envsDir, 'erc-contracts-deploy.env'), path.join(deployContractsDir, '.env'))
shell.cd(erc20ScriptDir)
shell.exec('node deployERC20.js')
shell.cd(deployContractsDir)
shell.exec('node deploy.js')
shell.rm('.env')
