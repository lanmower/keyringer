const { seed, keyPair, from, deriveCategorySeed, Keychain } = require('@keyringer/core')
const { buildTree, listKeys, rotateCategory, addServer, removeServer } = require('@keyringer/tree')
const { createToken } = require('@keyringer/auth')
const { fetchTree, fetchKey } = require('@keyringer/server')
const fs = require('fs').promises

const createMaster = () => {
  const s = seed()
  const kp = keyPair(s)
  return { seed: s.toString('hex'), keyPair: kp }
}

const loadMaster = (seedHex) => {
  const s = Buffer.from(seedHex, 'hex')
  return keyPair(s)
}

const saveMaster = async (file, seedHex) => {
  await fs.writeFile(file, seedHex, 'utf8')
}

const readMaster = async (file) => {
  const seedHex = await fs.readFile(file, 'utf8')
  return loadMaster(seedHex.trim())
}

const audit = (master, structure) => {
  const keys = listKeys(master, structure)
  const report = []
  for (const category in keys) {
    report.push(`\n${category}:`)
    report.push(`  public: ${keys[category]._pub}`)
    for (const server in keys[category]) {
      if (server === '_pub') continue
      const k = keys[category][server]
      report.push(`  ${server}:`)
      report.push(`    path: ${k.path}`)
      report.push(`    public: ${k.public}`)
      report.push(`    private: ${k.private ? '***' : 'N/A'}`)
    }
  }
  return report.join('\n')
}

const getBearer = (master, masterSeed, path, data, ttl) => {
  const [category, server] = path.split('/').filter(Boolean)
  const catSeed = deriveCategorySeed(masterSeed, category)
  const catKeychain = Keychain.from(keyPair(catSeed))
  const serverKey = catKeychain.get(server)
  return createToken(serverKey, data, ttl)
}

const distribute = async (tree, targets) => {
  const results = []
  for (const target of targets) {
    try {
      const result = await fetchKey(target)
      results.push({ target, success: true, result })
    } catch (error) {
      results.push({ target, success: false, error: error.message })
    }
  }
  return results
}

const retrieveTree = async (serverPublicKey) => {
  return fetchTree(serverPublicKey)
}

module.exports = {
  createMaster,
  loadMaster,
  saveMaster,
  readMaster,
  audit,
  getBearer,
  distribute,
  retrieveTree,
  buildTree,
  rotateCategory,
  addServer,
  removeServer
}
