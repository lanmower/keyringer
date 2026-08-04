const assert = require('assert')
const crypto = require('crypto')
const Keychain = require('keypear')
const DHT = require('hyperdht')
const { deriveSiblingsFromSeed, deriveSiblingsFromPublicKey, announce, load } = require('./index.js')

const run = async () => {
  const rootSeed = crypto.randomBytes(32)
  const rootPublicKey = Keychain.keyPair(rootSeed).publicKey
  const textPath = 'users/alice/inbox'

  // Sibling keys derived from the private root carry secret scalars, and are distinct.
  const priv = deriveSiblingsFromSeed(rootSeed, textPath)
  assert.ok(priv.address.scalar, 'address keypair should have a secret scalar')
  assert.ok(priv.encryption.scalar, 'encryption keypair should have a secret scalar')
  assert.notStrictEqual(
    priv.address.publicKey.toString('hex'),
    priv.encryption.publicKey.toString('hex'),
    'address and encryption keys must differ'
  )

  // The public-only root derives the exact same public keys (deterministic).
  const pub = deriveSiblingsFromPublicKey(rootPublicKey, textPath)
  assert.strictEqual(pub.address.publicKey.toString('hex'), priv.address.publicKey.toString('hex'))
  assert.strictEqual(pub.encryption.publicKey.toString('hex'), priv.encryption.publicKey.toString('hex'))
  assert.ok(!pub.address.scalar, 'public-only derivation must not expose a scalar')

  // A different text path must derive different keys.
  const other = deriveSiblingsFromSeed(rootSeed, 'users/bob/inbox')
  assert.notStrictEqual(other.address.publicKey.toString('hex'), priv.address.publicKey.toString('hex'))

  // Full round-trip over a real HyperDHT node: private pair announces, public pair loads.
  const dht = new DHT()
  try {
    const payload = 'super-secret-payload-for-the-other-side'
    await announce(dht, rootSeed, textPath, payload)
    const decrypted = await load(dht, rootPublicKey, textPath)
    assert.strictEqual(decrypted.toString('utf8'), payload)

    // Wrong text path cannot find the record.
    await assert.rejects(() => load(dht, rootPublicKey, 'users/bob/inbox'), /No record found/)
  } finally {
    await dht.destroy()
  }

  console.log('ok - all keyringer tests passed')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
