'use strict'

const net = require('net')
const msgdata = require('./msgdata')

const serverHandlers = require('./server_handlers')

const server = net.createServer(sock => {
  sock.on('data', data => {
    const { func, args } = msgdata.unmarshal(data)
    const ret = serverHandlers[func](...args)
    sock.end(msgdata.marshal({ ret: ret }))
  })
})

server.listen({
  host: 'localhost',
  port: 8080,
  exclusive: true
})
