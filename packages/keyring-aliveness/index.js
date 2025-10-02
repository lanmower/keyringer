const DHT = require('hyperdht')
const { pack, unpack } = require('msgpackr')
const { Keychain, keyPair, deriveCategorySeed } = require('@keyringer/core')
const { createChallenge, signChallenge, verifyChallenge } = require('@keyringer/auth')

const node = new DHT()

const startAlivenessServer = async (masterSeed, category, serverName) => {
  const catSeed = deriveCategorySeed(masterSeed, category)
  const catKeychain = Keychain.from(keyPair(catSeed))
  const serverKey = catKeychain.get(serverName)

  const server = node.createServer()

  server.on('connection', (socket) => {
    socket.on('data', async (data) => {
      try {
        const msg = unpack(data)

        if (msg.type === 'ping') {
          socket.write(pack({
            type: 'pong',
            server: serverName,
            category,
            timestamp: Date.now(),
            publicKey: serverKey.publicKey.toString('hex')
          }))
        }

        if (msg.type === 'challenge') {
          const challenge = msg.challenge
          const signature = signChallenge(serverKey, challenge)
          socket.write(pack({
            type: 'challenge-response',
            signature,
            publicKey: serverKey.publicKey.toString('hex'),
            server: serverName,
            category
          }))
        }

        if (msg.type === 'status') {
          socket.write(pack({
            type: 'status-report',
            server: serverName,
            category,
            uptime: process.uptime(),
            timestamp: Date.now(),
            version: '1.0.0',
            publicKey: serverKey.publicKey.toString('hex')
          }))
        }

      } catch (err) {
        socket.write(pack({
          type: 'error',
          error: err.message
        }))
      }
    })
  })

  await server.listen(serverKey)

  return {
    server,
    publicKey: serverKey.publicKey.toString('hex'),
    category,
    serverName,
    close: () => server.close()
  }
}

const checkAliveness = async (serverPublicKey, options = {}) => {
  const timeout = options.timeout || 5000
  const type = options.type || 'ping'

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.end()
      reject(new Error('Timeout'))
    }, timeout)

    const socket = node.connect(Buffer.from(serverPublicKey, 'hex'))

    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    if (type === 'ping') {
      socket.write(pack({ type: 'ping' }))
    } else if (type === 'challenge') {
      const challenge = createChallenge(serverPublicKey)
      socket.write(pack({ type: 'challenge', challenge: challenge.nonce }))
    } else if (type === 'status') {
      socket.write(pack({ type: 'status' }))
    }

    socket.once('data', (data) => {
      clearTimeout(timer)
      const response = unpack(data)
      socket.end()

      if (type === 'challenge' && response.type === 'challenge-response') {
        const verification = verifyChallenge(
          response.challenge?.id || 'direct',
          response.signature,
          response.publicKey
        )
        response.verified = verification.valid
      }

      resolve({
        alive: true,
        response,
        latency: Date.now() - (response.timestamp || Date.now())
      })
    })
  })
}

const monitorServers = async (serverList, interval = 30000) => {
  const results = new Map()

  const check = async () => {
    for (const server of serverList) {
      try {
        const result = await checkAliveness(server.publicKey, { type: 'status', timeout: 5000 })
        results.set(server.publicKey, {
          ...result,
          lastCheck: Date.now(),
          status: 'online',
          consecutiveFailures: 0
        })
      } catch (err) {
        const prev = results.get(server.publicKey) || { consecutiveFailures: 0 }
        results.set(server.publicKey, {
          alive: false,
          lastCheck: Date.now(),
          status: 'offline',
          error: err.message,
          consecutiveFailures: prev.consecutiveFailures + 1
        })
      }
    }
  }

  await check()
  const intervalId = setInterval(check, interval)

  return {
    results,
    stop: () => clearInterval(intervalId),
    checkNow: check
  }
}

const bulkCheck = async (serverList, options = {}) => {
  const results = await Promise.allSettled(
    serverList.map(server =>
      checkAliveness(server.publicKey, options)
        .then(result => ({ server, ...result }))
    )
  )

  return results.map((result, i) => ({
    server: serverList[i],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason.message : null
  }))
}

module.exports = {
  startAlivenessServer,
  checkAliveness,
  monitorServers,
  bulkCheck,
  close: () => node.destroy()
}
