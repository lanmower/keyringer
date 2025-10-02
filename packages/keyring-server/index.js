const { importTree } = require('@keyringer/core')
const DHT = require('hyperdht')
const { pack, unpack } = require('msgpackr')

const node = new DHT()

const serveTree = async (tree, myPath, port) => {
  const myKey = importTree(tree, myPath)
  const server = node.createServer()

  server.on('connection', (socket) => {
    socket.on('data', async (data) => {
      const msg = unpack(data)
      if (msg.type === 'getTree') {
        socket.write(pack({ tree }))
      }
      if (msg.type === 'getKey') {
        socket.write(pack({
          publicKey: myKey.publicKey.toString('hex'),
          path: myPath
        }))
      }
    })
  })

  await server.listen(myKey)
  return { key: myKey.publicKey.toString('hex'), port }
}

const fetchTree = async (publicKey) => {
  const socket = node.connect(Buffer.from(publicKey, 'hex'))
  return new Promise((resolve, reject) => {
    socket.write(pack({ type: 'getTree' }))
    socket.once('data', (data) => {
      const msg = unpack(data)
      socket.end()
      resolve(msg.tree)
    })
    socket.once('error', reject)
  })
}

const fetchKey = async (publicKey) => {
  const socket = node.connect(Buffer.from(publicKey, 'hex'))
  return new Promise((resolve, reject) => {
    socket.write(pack({ type: 'getKey' }))
    socket.once('data', (data) => {
      const msg = unpack(data)
      socket.end()
      resolve(msg)
    })
    socket.once('error', reject)
  })
}

const discoverSiblings = async (tree, myPath) => {
  const [category] = myPath.split('/').filter(Boolean)
  const branch = tree.branches[category]
  if (!branch) return []

  const catPubKey = branch.publicKey
  const siblings = []

  for (const cat in tree.branches) {
    if (cat === category) continue
    siblings.push(tree.branches[cat].publicKey)
  }

  return siblings
}

module.exports = {
  serveTree,
  fetchTree,
  fetchKey,
  discoverSiblings,
  close: () => node.destroy()
}
