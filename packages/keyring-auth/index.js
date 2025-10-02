const { from, deriveKey } = require('@keyringer/core')
const crypto = require('hypercore-crypto')

const CHALLENGE_EXPIRY = 60000

const challenges = new Map()

const createChallenge = (publicKey) => {
  const nonce = crypto.randomBytes(32)
  const id = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + CHALLENGE_EXPIRY
  challenges.set(id, { nonce, publicKey, expires })
  setTimeout(() => challenges.delete(id), CHALLENGE_EXPIRY)
  return { id, nonce: nonce.toString('hex'), expires }
}

const signChallenge = (keyPair, nonce) => {
  const key = from(keyPair)
  if (!key.sign) throw new Error('Key cannot sign')
  return key.sign(Buffer.from(nonce, 'hex')).toString('hex')
}

const verifyChallenge = (id, signature, publicKey) => {
  const challenge = challenges.get(id)
  if (!challenge) return { valid: false, error: 'Challenge not found or expired' }
  if (Date.now() > challenge.expires) {
    challenges.delete(id)
    return { valid: false, error: 'Challenge expired' }
  }
  if (challenge.publicKey && challenge.publicKey !== publicKey) {
    return { valid: false, error: 'Public key mismatch' }
  }

  const key = from(Buffer.from(publicKey, 'hex'))
  const sig = Buffer.from(signature, 'hex')
  const valid = key.verify(challenge.nonce, sig)

  challenges.delete(id)
  return { valid, error: valid ? null : 'Invalid signature' }
}

const createToken = (keyPair, data, ttl = 3600000) => {
  const key = from(keyPair)
  const expires = Date.now() + ttl
  const payload = { data, expires }
  const message = Buffer.from(JSON.stringify(payload))
  const signature = key.sign(message).toString('hex')
  return { payload, signature, publicKey: key.publicKey.toString('hex') }
}

const verifyToken = (token) => {
  const { payload, signature, publicKey } = token
  if (Date.now() > payload.expires) {
    return { valid: false, error: 'Token expired', data: null }
  }
  const key = from(Buffer.from(publicKey, 'hex'))
  const message = Buffer.from(JSON.stringify(payload))
  const sig = Buffer.from(signature, 'hex')
  const valid = key.verify(message, sig)
  return { valid, error: valid ? null : 'Invalid token', data: payload.data }
}

module.exports = {
  createChallenge,
  signChallenge,
  verifyChallenge,
  createToken,
  verifyToken
}
