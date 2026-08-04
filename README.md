# Keyringer

Deterministic capability trees on HyperDHT, built on `keypear` and `hyperdht`.

Any text path (e.g. `"users/alice/inbox"`) derives two sibling Ed25519 keypairs:

- **address** — signs and addresses the HyperDHT mutable record. Safe to broadcast.
- **encryption** — never broadcast. Its public key seeds an AES-256-GCM key. Because it's
  a sibling of, not identical to, the address key, a DHT sniffer who observes and fetches
  the record still cannot derive the encryption key without the text path.

## The two pairs

- **Private pair** (root seed + text path + payload) — derives both sibling keys, encrypts
  the payload, and announces it on HyperDHT (`announce`).
- **Public pair** (root public key + text path) — deterministically derives the same sibling
  public keys, looks the record up on HyperDHT, and decrypts it (`load`).

Since `keypear` derivation is public-key-only capable, the public pair never needs the
private root — only the root public key and the text path, both of which can be shared
out of band.

## Usage

```js
const DHT = require('hyperdht')
const crypto = require('crypto')
const Keychain = require('keypear')
const { announce, load } = require('keyringer')

const dht = new DHT()
const rootSeed = crypto.randomBytes(32)
const rootPublicKey = Keychain.keyPair(rootSeed).publicKey

// Private pair: encrypt and announce
await announce(dht, rootSeed, 'trees/my-app/secure-key-01', 'super-secret-payload')

// Public pair: look up and decrypt
const payload = await load(dht, rootPublicKey, 'trees/my-app/secure-key-01')
console.log(payload.toString()) // 'super-secret-payload'

await dht.destroy()
```

## CLI

```bash
npx keyringer seed
npx keyringer announce <rootSeedHex> <textPath> <payload>
npx keyringer load <rootPublicKeyHex> <textPath>
```

## Testing

```bash
npm test
```

## License

MIT
