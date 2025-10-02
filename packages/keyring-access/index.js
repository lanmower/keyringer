const { from, deriveKeychain, derivePublic, deriveCategorySeed, Keychain, seed: createSeed, keyPair } = require('@keyringer/core')

const ACCESS_LEVELS = {
  NONE: 0,
  PUBLIC_ONLY: 1,
  CATEGORY_READ: 2,
  CATEGORY_SIGN: 3,
  FULL_CONTROL: 4
}

const createAccessGrant = (masterKey, masterSeed, targetPath, level) => {
  const base = from(masterKey)
  const [category, server] = targetPath.split('/').filter(Boolean)

  if (level === ACCESS_LEVELS.NONE) {
    return { level: ACCESS_LEVELS.NONE, grant: null }
  }

  if (level === ACCESS_LEVELS.PUBLIC_ONLY) {
    const catSeed = deriveCategorySeed(masterSeed, category)
    const catKeychain = Keychain.from(keyPair(catSeed))
    const targetKey = catKeychain.get(server)
    return {
      level: ACCESS_LEVELS.PUBLIC_ONLY,
      grant: {
        publicKey: targetKey.publicKey.toString('hex'),
        path: targetPath
      }
    }
  }

  if (level === ACCESS_LEVELS.CATEGORY_READ) {
    const catSeed = deriveCategorySeed(masterSeed, category)
    const catKeychain = Keychain.from(keyPair(catSeed))
    return {
      level: ACCESS_LEVELS.CATEGORY_READ,
      grant: {
        publicKey: catKeychain.publicKey.toString('hex'),
        category,
        path: targetPath
      }
    }
  }

  if (level === ACCESS_LEVELS.CATEGORY_SIGN) {
    const catSeed = deriveCategorySeed(masterSeed, category)
    const catKeychain = Keychain.from(keyPair(catSeed))
    return {
      level: ACCESS_LEVELS.CATEGORY_SIGN,
      grant: {
        categorySeed: catSeed.toString('hex'),
        publicKey: catKeychain.publicKey.toString('hex'),
        category,
        path: targetPath
      }
    }
  }

  if (level === ACCESS_LEVELS.FULL_CONTROL) {
    return {
      level: ACCESS_LEVELS.FULL_CONTROL,
      grant: {
        masterSeed: masterSeed.toString('hex'),
        publicKey: base.publicKey.toString('hex'),
        path: 'master'
      }
    }
  }

  throw new Error('Invalid access level')
}

const verifyAccess = (grant, requestedPath) => {
  if (!grant || grant.level === ACCESS_LEVELS.NONE) {
    return { allowed: false, reason: 'No access granted' }
  }

  if (grant.level === ACCESS_LEVELS.PUBLIC_ONLY) {
    if (grant.grant.path !== requestedPath) {
      return { allowed: false, reason: 'Path mismatch' }
    }
    return { allowed: true, capabilities: ['verify'] }
  }

  if (grant.level === ACCESS_LEVELS.CATEGORY_READ) {
    const [reqCat] = requestedPath.split('/').filter(Boolean)
    if (reqCat !== grant.grant.category) {
      return { allowed: false, reason: 'Category mismatch' }
    }
    return { allowed: true, capabilities: ['derive-public', 'verify'] }
  }

  if (grant.level === ACCESS_LEVELS.CATEGORY_SIGN) {
    if (grant.grant.path !== requestedPath) {
      return { allowed: false, reason: 'Path mismatch' }
    }
    return { allowed: true, capabilities: ['sign', 'verify'] }
  }

  if (grant.level === ACCESS_LEVELS.FULL_CONTROL) {
    return { allowed: true, capabilities: ['derive', 'sign', 'verify', 'grant'] }
  }

  return { allowed: false, reason: 'Unknown access level' }
}

const canEscalate = (currentGrant, requestedGrant) => {
  if (!currentGrant) return false
  if (currentGrant.level < requestedGrant.level) return false
  if (currentGrant.level === ACCESS_LEVELS.FULL_CONTROL) return true
  if (currentGrant.level === ACCESS_LEVELS.CATEGORY_SIGN) {
    const [currCat] = currentGrant.grant.path.split('/').filter(Boolean)
    const [reqCat] = requestedGrant.path.split('/').filter(Boolean)
    return currCat === reqCat && requestedGrant.level <= ACCESS_LEVELS.CATEGORY_READ
  }

  return false
}

module.exports = {
  ACCESS_LEVELS,
  createAccessGrant,
  verifyAccess,
  canEscalate
}
