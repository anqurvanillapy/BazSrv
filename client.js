const net = require('net')
const msgdata = require('./msgdata')

const client = net.createConnection(
  {
    host: 'localhost',
    port: 8080
  },
  () => {
    const msg = { func: 'foo', args: [2] }
    client.write(msgdata.marshal(msg))
  }
)

client.on('data', data => {
  const { ret } = msgdata.unmarshal(data)
  console.log(ret)
  client.end()
})
