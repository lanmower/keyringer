const Keychain = require('keypear')
const crypto = require('hypercore-crypto')

const deriveCategorySeed = (masterSeed, category) => {
  return crypto.hash(Buffer.concat([
    masterSeed,
    Buffer.from(category)
  ]))
}

const deriveKeychain = (base, path) => {
  if (!path) return base
  const parts = path.split('/').filter(Boolean)
  let current = base
  for (const part of parts) {
    current = current.sub(part)
  }
  return current
}

const deriveKey = (base, path) => {
  if (!path) return base
  const parts = path.split('/').filter(Boolean)
  let current = base
  for (let i = 0; i < parts.length - 1; i++) {
    current = current.sub(parts[i])
  }
  return current.get(parts[parts.length - 1])
}

const derivePublic = (publicKey, path) => {
  if (!path) return Keychain.from(publicKey)
  const parts = path.split('/').filter(Boolean)
  let current = Keychain.from(publicKey)
  for (const part of parts) {
    current = current.sub(part)
  }
  return current
}

const exportTree = (base, paths = []) => {
  const encrypted = crypto.encrypt(base.home.scalar, base.publicKey)
  const branches = {}
  for (const path of paths) {
    const parts = path.split('/').filter(Boolean)
    const category = parts[0]
    if (!branches[category]) {
      const catKey = base.get(category)
      branches[category] = {
        publicKey: catKey.publicKey.toString('hex'),
        tweak: category
      }
    }
  }
  return { encrypted: encrypted.toString('hex'), branches }
}

const importTree = (tree, myPath) => {
  const parts = myPath.split('/').filter(Boolean)
  const [category, server] = parts
  const branch = tree.branches[category]
  if (!branch) throw new Error('Category not in tree')
  const catKey = Keychain.from(Buffer.from(branch.publicKey, 'hex'))
  return catKey.get(server)
}

const seed = () => Keychain.seed()
const keyPair = (s) => Keychain.keyPair(s)
const from = (k) => Keychain.from(k)

module.exports = {
  deriveKey,
  deriveKeychain,
  derivePublic,
  deriveCategorySeed,
  exportTree,
  importTree,
  seed,
  keyPair,
  from,
  Keychain
}
