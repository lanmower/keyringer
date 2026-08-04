const Keychain = require('keypear')
const crypto = require('crypto')

const segments = (textPath) => String(textPath).split('/').filter(Boolean)

// Derive the two sibling keypairs for a text path from a keychain (private or public-only).
// - address:    signs/addresses the HyperDHT mutable record (safe to broadcast)
// - encryption: never broadcast; its public key seeds the AES key (DHT sniffers can't derive it)
const deriveSiblings = (keychain, textPath) => {
  let node = keychain
  for (const segment of segments(textPath)) node = node.sub(segment)
  return { address: node.get('address'), encryption: node.get('encryption') }
}

const deriveSiblingsFromSeed = (rootSeed, textPath) => deriveSiblings(new Keychain(Keychain.keyPair(rootSeed)), textPath)
const deriveSiblingsFromPublicKey = (rootPublicKey, textPath) => deriveSiblings(new Keychain(rootPublicKey), textPath)

const encryptionKeyFor = (encryptionPublicKey) =>
  crypto.createHash('sha256').update(encryptionPublicKey).digest()

const encrypt = (encryptionPublicKey, payload) => {
  const key = encryptionKeyFor(encryptionPublicKey)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

const decrypt = (encryptionPublicKey, encrypted) => {
  const key = encryptionKeyFor(encryptionPublicKey)
  const iv = encrypted.subarray(0, 12)
  const authTag = encrypted.subarray(12, 28)
  const ciphertext = encrypted.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// Private pair: root seed + text path + payload -> encrypt and announce on HyperDHT.
const announce = async (dht, rootSeed, textPath, payload) => {
  const { address, encryption } = deriveSiblingsFromSeed(rootSeed, textPath)
  const value = encrypt(encryption.publicKey, payload)
  const result = await dht.mutablePut(address, value)
  return { publicKey: result.publicKey, seq: result.seq, textPath }
}

// Public pair: root public key + text path -> look up and decrypt from HyperDHT.
const load = async (dht, rootPublicKey, textPath) => {
  const { address, encryption } = deriveSiblingsFromPublicKey(rootPublicKey, textPath)
  const record = await dht.mutableGet(address.publicKey)
  if (!record || !record.value) throw new Error(`No record found at path "${textPath}"`)
  return decrypt(encryption.publicKey, record.value)
}

module.exports = {
  deriveSiblingsFromSeed,
  deriveSiblingsFromPublicKey,
  announce,
  load
}
