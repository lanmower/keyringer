#!/usr/bin/env node

const DHT = require('hyperdht')
const { announce, load, generateRootSeed } = require('./index.js')

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

const withDht = async (fn) => {
  const dht = new DHT()
  try {
    return await fn(dht)
  } finally {
    await dht.destroy()
  }
}

const main = async () => {
  if (command === 'seed') {
    const { seed, publicKey } = generateRootSeed()
    console.log('seed:', seed.toString('hex'))
    console.log('publicKey:', publicKey.toString('hex'))
    return
  }

  if (command === 'announce') {
    const [, rootSeedHex, textPath, payload] = args
    if (!rootSeedHex || !textPath || !payload) return usage()
    const result = await withDht((dht) => announce(dht, Buffer.from(rootSeedHex, 'hex'), textPath, payload))
    console.log('announced at:', result.publicKey.toString('hex'), 'seq:', result.seq)
    return
  }

  if (command === 'load') {
    const [, rootPublicKeyHex, textPath] = args
    if (!rootPublicKeyHex || !textPath) return usage()
    const value = await withDht((dht) => load(dht, Buffer.from(rootPublicKeyHex, 'hex'), textPath))
    console.log(value.toString('utf8'))
    return
  }

  usage()
  if (command && command !== '--help' && command !== '-h') process.exit(1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
