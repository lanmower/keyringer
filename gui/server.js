const express = require('express')
const fs = require('fs').promises
const path = require('path')
const { spawn } = require('child_process')
const client = require('../packages/keyring-client')
const { ACCESS_LEVELS, createAccessGrant } = require('../packages/keyring-access')
const { createKeyDrive, shareTree, loadTree, addGrant, revokeGrant, syncToFlatfile } = require('../packages/keyring-drive')
const { Keychain, keyPair, deriveCategorySeed } = require('../packages/keyring-core')
const { checkAliveness, bulkCheck } = require('../packages/keyring-aliveness')
const { generateBootstrapScript } = require('../packages/keyring-bootstrap')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = 3777
const VITE_PORT = 5174

let masterKey = null
let masterSeed = null
let currentStructure = {}
let keyDrive = null

app.use(express.json())

const apiRouter = express.Router()

apiRouter.post('/init', async (req, res) => {
  try {
    const created = client.createMaster()
    masterSeed = Buffer.from(created.seed, 'hex')
    masterKey = created.keyPair
    await client.saveMaster('./master.key', created.seed)
    res.json({ success: true, publicKey: masterKey.publicKey.toString('hex'), seed: created.seed })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/load', async (req, res) => {
  try {
    const seedHex = await fs.readFile('./master.key', 'utf8')
    masterSeed = Buffer.from(seedHex.trim(), 'hex')
    masterKey = await client.readMaster('./master.key')
    res.json({ success: true, publicKey: masterKey.publicKey.toString('hex'), seed: seedHex.trim() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.get('/structure', (req, res) => {
  res.json({ structure: currentStructure })
})

apiRouter.post('/category', (req, res) => {
  const { name } = req.body
  if (!currentStructure[name]) {
    currentStructure[name] = []
  }
  res.json({ success: true, structure: currentStructure })
})

apiRouter.post('/server', (req, res) => {
  const { category, server } = req.body
  if (!currentStructure[category]) {
    currentStructure[category] = []
  }
  if (!currentStructure[category].includes(server)) {
    currentStructure[category].push(server)
  }
  res.json({ success: true, structure: currentStructure })
})

apiRouter.delete('/server/:category/:server', (req, res) => {
  const { category, server } = req.params
  if (currentStructure[category]) {
    currentStructure[category] = currentStructure[category].filter(s => s !== server)
    if (currentStructure[category].length === 0) {
      delete currentStructure[category]
    }
  }
  res.json({ success: true, structure: currentStructure })
})

apiRouter.get('/audit', (req, res) => {
  if (!masterKey) {
    return res.status(400).json({ error: 'No master key loaded' })
  }
  const report = client.audit(masterKey, currentStructure)
  res.json({ report })
})

apiRouter.get('/keys/full', (req, res) => {
  if (!masterKey || !masterSeed) {
    return res.status(400).json({ error: 'No master key loaded' })
  }

  const fullKeys = {
    master: {
      seed: masterSeed.toString('hex'),
      publicKey: masterKey.publicKey.toString('hex')
    },
    categories: {}
  }

  for (const category in currentStructure) {
    const catSeed = deriveCategorySeed(masterSeed, category)
    const catKeychain = Keychain.from(keyPair(catSeed))

    fullKeys.categories[category] = {
      seed: catSeed.toString('hex'),
      publicKey: catKeychain.publicKey.toString('hex'),
      servers: {}
    }

    for (const server of currentStructure[category]) {
      const serverKey = catKeychain.get(server)
      fullKeys.categories[category].servers[server] = {
        publicKey: serverKey.publicKey.toString('hex'),
        privateKey: serverKey.scalar.toString('hex'),
        path: `${category}/${server}`
      }
    }
  }

  res.json(fullKeys)
})

apiRouter.post('/grant', async (req, res) => {
  try {
    const { path, level } = req.body
    if (!masterKey || !masterSeed) {
      return res.status(400).json({ error: 'No master key loaded' })
    }
    const grant = createAccessGrant(masterKey, masterSeed, path, level)
    res.json({ success: true, grant })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/drive/create', async (req, res) => {
  try {
    if (!masterKey) {
      return res.status(400).json({ error: 'No master key loaded' })
    }
    const tree = client.buildTree(masterKey, currentStructure)
    keyDrive = await createKeyDrive('./key-drive')
    const driveKey = await shareTree(keyDrive.drive, tree, {})
    res.json({ success: true, driveKey })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/drive/grant', async (req, res) => {
  try {
    const { path, level } = req.body
    if (!keyDrive) {
      return res.status(400).json({ error: 'No drive created' })
    }
    const grant = createAccessGrant(masterKey, masterSeed, path, level)
    await addGrant(keyDrive.drive, path, grant)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.get('/keys/:category/:server', (req, res) => {
  try {
    if (!masterKey) {
      return res.status(400).json({ error: 'No master key loaded' })
    }
    const keys = client.buildTree(masterKey, currentStructure)
    const path = `${req.params.category}/${req.params.server}`
    res.json({ path, keys })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/aliveness/check', async (req, res) => {
  try {
    const { publicKey, type = 'ping' } = req.body
    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey required' })
    }
    const result = await checkAliveness(publicKey, { type, timeout: 5000 })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message, alive: false })
  }
})

apiRouter.post('/aliveness/bulk', async (req, res) => {
  try {
    if (!masterKey || !masterSeed) {
      return res.status(400).json({ error: 'No master key loaded' })
    }
    const serverList = []
    for (const category in currentStructure) {
      const catSeed = deriveCategorySeed(masterSeed, category)
      const catKeychain = Keychain.from(keyPair(catSeed))
      for (const server of currentStructure[category]) {
        const serverKey = catKeychain.get(server)
        serverList.push({
          name: `${category}/${server}`,
          publicKey: serverKey.publicKey.toString('hex'),
          category,
          server
        })
      }
    }
    const results = await bulkCheck(serverList, { type: 'status', timeout: 5000 })
    res.json({ results })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/bootstrap/script', async (req, res) => {
  try {
    const { category, server, discoverySecret } = req.body
    if (!masterKey || !masterSeed) {
      return res.status(400).json({ error: 'No master key loaded' })
    }
    if (!category || !server) {
      return res.status(400).json({ error: 'category and server required' })
    }
    const serverPath = `${category}/${server}`
    const grant = createAccessGrant(masterKey, masterSeed, serverPath, ACCESS_LEVELS.CATEGORY_SIGN)
    const secret = discoverySecret || `keyringer-${category}-${Date.now()}`
    const script = generateBootstrapScript(category, server, grant, secret)
    res.json({ script, discoverySecret: secret, grant })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.post('/drive/sync', async (req, res) => {
  try {
    if (!keyDrive) {
      return res.status(400).json({ error: 'No drive created' })
    }
    const targetDir = req.body.targetDir || './key-flatfiles'
    const result = await syncToFlatfile(keyDrive.drive, targetDir)
    res.json({ success: true, ...result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

console.log('Starting Vite dev server...')
const viteProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'wallet-ui'),
  stdio: 'inherit',
  shell: true
})

app.use('/api', apiRouter)

const server = app.listen(PORT, () => {
  console.log(`Keyringer GUI running at http://localhost:${PORT}`)
})

setTimeout(() => {
  app.use('/', createProxyMiddleware({
    target: `http://localhost:${VITE_PORT}`,
    changeOrigin: true,
    ws: false,
    filter: (pathname) => !pathname.startsWith('/api'),
    onError: (err, req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Frontend server is starting, please wait...')
    }
  }))
  console.log(`Proxying frontend from Vite dev server on port ${VITE_PORT}`)
}, 3000)

process.on('SIGINT', () => {
  console.log('\nShutting down...')
  viteProcess.kill()
  process.exit(0)
})
