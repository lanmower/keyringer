const { from, deriveCategorySeed, Keychain, keyPair } = require('@keyringer/core')
const { verifyAccess, ACCESS_LEVELS } = require('@keyringer/access')

const createRecoveryShare = (masterKey, masterSeed, path, recipientGrant) => {
  const [category, server] = path.split('/').filter(Boolean)

  const access = verifyAccess(recipientGrant, path)
  if (!access.allowed) {
    throw new Error(`Recovery denied: ${access.reason}`)
  }

  const catSeed = deriveCategorySeed(masterSeed, category)
  const catKeychain = Keychain.from(keyPair(catSeed))

  if (recipientGrant.level === ACCESS_LEVELS.PUBLIC_ONLY) {
    const serverKey = catKeychain.get(server)
    return {
      type: 'public-only',
      publicKey: serverKey.publicKey.toString('hex'),
      path,
      grantLevel: recipientGrant.level
    }
  }

  if (recipientGrant.level === ACCESS_LEVELS.CATEGORY_READ) {
    return {
      type: 'category-read',
      publicKey: catKeychain.publicKey.toString('hex'),
      category,
      path,
      grantLevel: recipientGrant.level
    }
  }

  if (recipientGrant.level === ACCESS_LEVELS.CATEGORY_SIGN) {
    return {
      type: 'category-sign',
      categorySeed: catSeed.toString('hex'),
      publicKey: catKeychain.publicKey.toString('hex'),
      category,
      path,
      grantLevel: recipientGrant.level
    }
  }

  throw new Error('Invalid grant level for recovery')
}

const storeRecoveryShares = (shares) => {
  const store = {}
  for (const share of shares) {
    const path = share.path || share.grant?.path
    if (!path) continue
    if (!store[path]) {
      store[path] = []
    }
    store[path].push(share)
  }
  return store
}

const requestRecovery = (store, path, myGrant) => {
  const shares = store[path]
  if (!shares || shares.length === 0) {
    throw new Error('No recovery shares available')
  }

  const access = verifyAccess(myGrant, path)
  if (!access.allowed) {
    throw new Error(`Access denied: ${access.reason}`)
  }

  if (myGrant.level === ACCESS_LEVELS.PUBLIC_ONLY) {
    const publicShare = shares.find(s => s.type === 'public-only')
    if (!publicShare) {
      throw new Error('No public-only share available')
    }
    return publicShare
  }

  if (myGrant.level === ACCESS_LEVELS.CATEGORY_READ) {
    const catShare = shares.find(s => s.type === 'category-read')
    if (!catShare) {
      throw new Error('No category-read share available')
    }
    return catShare
  }

  if (myGrant.level === ACCESS_LEVELS.CATEGORY_SIGN) {
    const catShare = shares.find(s => s.type === 'category-sign')
    if (!catShare) {
      throw new Error('No category-sign share available')
    }
    return catShare
  }

  throw new Error('Invalid grant level')
}

const canRecover = (myGrant, requestedPath) => {
  const access = verifyAccess(myGrant, requestedPath)
  return access.allowed
}

module.exports = {
  createRecoveryShare,
  storeRecoveryShares,
  requestRecovery,
  canRecover
}
