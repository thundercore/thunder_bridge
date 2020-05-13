const path = require('path')
const fs = require('fs')

var configFile = path.join(__dirname, process.argv[2]? process.argv[2]: '')
var fstat = new fs.Stats()
if (process.env.NODE_ENV === "test" && !fstat.isFile(configFile)) {
  configFile = path.join(__dirname, "test.config.js")
}

const config = require(configFile)
module.exports = config