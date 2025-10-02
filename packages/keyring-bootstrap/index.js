const DHT = require('hyperdht')
const { pack, unpack } = require('msgpackr')
const { Keychain, keyPair, deriveCategorySeed } = require('@keyringer/core')
const { createAccessGrant, ACCESS_LEVELS } = require('@keyringer/access')
const { startAlivenessServer } = require('@keyringer/aliveness')
const crypto = require('hypercore-crypto')
const fs = require('fs').promises
const path = require('path')

const deriveDiscoveryKey = (secretString) => {
  return crypto.hash(Buffer.from(secretString))
}

const announceServer = async (discoveryKey, serverInfo) => {
  const node = new DHT()
  const topic = crypto.hash(discoveryKey)

  await node.announce(topic, serverInfo.keyPair)

  return {
    node,
    topic,
    close: () => node.destroy()
  }
}

const lookupServers = async (discoveryKey, timeout = 5000) => {
  const node = new DHT()
  const topic = crypto.hash(discoveryKey)
  const servers = []

  const stream = node.lookup(topic)

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stream.destroy()
      node.destroy()
      resolve(servers)
    }, timeout)

    stream.on('data', (data) => {
      servers.push({
        publicKey: data.publicKey.toString('hex'),
        from: data.from
      })
    })

    stream.on('end', () => {
      clearTimeout(timer)
      node.destroy()
      resolve(servers)
    })
  })
}

const bootstrapServer = async (masterSeed, category, serverName, discoverySecret, options = {}) => {
  const configDir = options.configDir || './keyring-config'
  await fs.mkdir(configDir, { recursive: true })

  const catSeed = deriveCategorySeed(masterSeed, category)
  const catKeychain = Keychain.from(keyPair(catSeed))
  const serverKey = catKeychain.get(serverName)

  const config = {
    category,
    serverName,
    publicKey: serverKey.publicKey.toString('hex'),
    privateKey: serverKey.scalar.toString('hex'),
    categorySeed: catSeed.toString('hex'),
    discoverySecret,
    path: `${category}/${serverName}`
  }

  await fs.writeFile(
    path.join(configDir, 'server-config.json'),
    JSON.stringify(config, null, 2)
  )

  const discoveryKey = deriveDiscoveryKey(discoverySecret)

  const announcement = await announceServer(discoveryKey, {
    keyPair: serverKey,
    category,
    serverName
  })

  const alivenessServer = await startAlivenessServer(masterSeed, category, serverName)

  return {
    config,
    announcement,
    alivenessServer,
    close: async () => {
      announcement.close()
      alivenessServer.close()
    }
  }
}

const loadServerConfig = async (configDir = './keyring-config') => {
  const configPath = path.join(configDir, 'server-config.json')
  const configData = await fs.readFile(configPath, 'utf8')
  return JSON.parse(configData)
}

const generateBootstrapScript = (category, serverName, grant, discoverySecret) => {
  const script = `#!/bin/bash
# Keyringer Server Bootstrap Script
# Category: ${category}
# Server: ${serverName}
# Generated: ${new Date().toISOString()}

mkdir -p keyring-config

cat > keyring-config/server-config.json <<'EOF'
${JSON.stringify({
  category,
  serverName,
  categorySeed: grant.grant.categorySeed,
  publicKey: grant.grant.publicKey,
  discoverySecret,
  path: grant.grant.path
}, null, 2)}
EOF

cat > keyring-config/start-server.js <<'EOF'
const { bootstrapFromConfig } = require('@keyringer/bootstrap')

bootstrapFromConfig('./keyring-config').then(server => {
  console.log('✓ Server started:', server.config.path)
  console.log('✓ Public key:', server.config.publicKey)
  console.log('✓ Announced on discovery topic')
  console.log('✓ Aliveness server running')
}).catch(console.error)
EOF

npm install @keyringer/bootstrap @keyringer/core @keyringer/access @keyringer/aliveness
node keyring-config/start-server.js
`
  return script
}

const bootstrapFromConfig = async (configDir = './keyring-config') => {
  const config = await loadServerConfig(configDir)

  const categorySeed = Buffer.from(config.categorySeed, 'hex')
  const catKeychain = Keychain.from(keyPair(categorySeed))
  const serverKey = catKeychain.get(config.serverName)

  const discoveryKey = deriveDiscoveryKey(config.discoverySecret)

  const announcement = await announceServer(discoveryKey, {
    keyPair: serverKey,
    category: config.category,
    serverName: config.serverName
  })

  const masterSeed = categorySeed
  const alivenessServer = await startAlivenessServer(masterSeed, config.category, config.serverName)

  return {
    config,
    announcement,
    alivenessServer,
    close: async () => {
      announcement.close()
      alivenessServer.close()
    }
  }
}

module.exports = {
  deriveDiscoveryKey,
  announceServer,
  lookupServers,
  bootstrapServer,
  loadServerConfig,
  generateBootstrapScript,
  bootstrapFromConfig
}
