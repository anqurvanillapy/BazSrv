'use strict'

module.exports =
`'use strict'

const net = require('net')

// const proto = require('./FIXME.proto')

const client = net.createConnection(
  {
    host: 'localhost',
    port: 8080
  },
  () => {
    // const msg = new proto.TODO({ /* TODO */ })
    // client.write(msg.marshal())
  }
)

client.on('data', data => {
  // const msg = proto.TODO.unmarshal(data)
  // client.end()
})
`
