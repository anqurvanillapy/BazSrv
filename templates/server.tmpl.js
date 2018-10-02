'use strict'

module.exports =
`'use strict'

const net = require('net')

// const proto = require('./FIXME.proto')
// const service = require('./FIXME.service')

const server = net.createServer(sock => {
  sock.on('data', data => {
    // const msg = proto.TODO.unmarshal(data)
    // const ret = service.broke(msg)
    // sock.end(ret.marshal())
  })
})

server.listen({
  host: 'localhost',
  port: 8080,
  exclusive: true
})
`
