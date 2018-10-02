'use strict'

const util = require('util')

const expects = (cond, err) => {
  if (!cond) {
    console.error(err)
    process.exit(1)
  }
}

const deeplog = obj =>
  console.log(util.inspect(obj, false, null, true))

const Id = x => x

module.exports = {
  expects,
  deeplog,
  Id
}
