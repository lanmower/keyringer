#!/usr/bin/env node

const DHT = require('hyperdht')
const crypto = require('crypto')
const { announce, load } = require('./index.js')

const args = process.argv.slice(2)
const command = args[0]

const usage = () => {
  console.log(`
Keyringer - deterministic keypear + HyperDHT capability trees

Usage:
  keyringer announce <rootSeedHex> <textPath> <payload>   Encrypt and announce (private pair)
  keyringer load <rootPublicKeyHex> <textPath>             Look up and decrypt (public pair)
  keyringer seed                                           Generate a new root seed
  keyringer --help                                         Show this help
`)
}

const main = async () => {
  if (command === 'seed') {
    const seed = crypto.randomBytes(32)
    const Keychain = require('keypear')
    const rootKeyPair = Keychain.keyPair(seed)
    console.log('seed:', seed.toString('hex'))
    console.log('publicKey:', rootKeyPair.publicKey.toString('hex'))
    return
  }

  if (command === 'announce') {
    const [, rootSeedHex, textPath, payload] = args
    if (!rootSeedHex || !textPath || !payload) return usage()
    const dht = new DHT()
    try {
      const result = await announce(dht, Buffer.from(rootSeedHex, 'hex'), textPath, payload)
      console.log('announced at:', result.publicKey.toString('hex'), 'seq:', result.seq)
    } finally {
      await dht.destroy()
    }
    return
  }

  if (command === 'load') {
    const [, rootPublicKeyHex, textPath] = args
    if (!rootPublicKeyHex || !textPath) return usage()
    const dht = new DHT()
    try {
      const value = await load(dht, Buffer.from(rootPublicKeyHex, 'hex'), textPath)
      console.log(value.toString('utf8'))
    } finally {
      await dht.destroy()
    }
    return
  }

  usage()
  if (command && command !== '--help' && command !== '-h') process.exit(1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
