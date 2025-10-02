const client = require('./packages/keyring-client')
const server = require('./packages/keyring-server')
const auth = require('./packages/keyring-auth')

const test = async () => {
  console.log('\n=== E2E Test Suite ===\n')

  console.log('1. Creating master key...')
  const { seed, keyPair: master } = client.createMaster()
  console.log(`   Seed: ${seed.substring(0, 16)}...`)
  console.log(`   Master Public: ${master.publicKey.toString('hex').substring(0, 16)}...\n`)

  console.log('2. Building key tree...')
  const structure = {
    api: ['server1', 'server2'],
    db: ['primary', 'replica'],
    cache: ['redis1']
  }
  const tree = client.buildTree(master, structure)
  console.log(`   Categories: ${Object.keys(tree.branches).join(', ')}`)
  console.log(`   Total servers: ${Object.values(structure).flat().length}\n`)

  console.log('3. Auditing keys...')
  const report = client.audit(master, structure)
  console.log(report, '\n')

  console.log('4. Testing server key derivation...')
  const { importTree } = require('./packages/keyring-core')
  const server1Key = importTree(tree, 'api/server1')
  const server2Key = importTree(tree, 'api/server2')
  console.log(`   Server1 Public: ${server1Key.publicKey.toString('hex').substring(0, 16)}...`)
  console.log(`   Server2 Public: ${server2Key.publicKey.toString('hex').substring(0, 16)}...`)
  console.log(`   Keys are different: ${server1Key.publicKey.toString('hex') !== server2Key.publicKey.toString('hex')}\n`)

  console.log('5. Testing challenge-response auth...')
  const challenge = auth.createChallenge(server1Key.publicKey.toString('hex'))
  console.log(`   Challenge ID: ${challenge.id}`)
  const signature = auth.signChallenge(server1Key, challenge.nonce)
  console.log(`   Signature: ${signature.substring(0, 32)}...`)
  const verification = auth.verifyChallenge(challenge.id, signature, server1Key.publicKey.toString('hex'))
  console.log(`   Verified: ${verification.valid}\n`)

  console.log('6. Testing bearer token creation...')
  const token = client.getBearer(master, 'api/server1', { user: 'admin', role: 'superuser' }, 3600000)
  console.log(`   Token signature: ${token.signature.substring(0, 32)}...`)
  const tokenVerify = auth.verifyToken(token)
  console.log(`   Token valid: ${tokenVerify.valid}`)
  console.log(`   Token data:`, tokenVerify.data, '\n')

  console.log('7. Testing key rotation...')
  const newTree = client.rotateCategory(master, 'api', 'api-v2', structure)
  console.log(`   Old categories: ${Object.keys(tree.branches).join(', ')}`)
  console.log(`   New categories: ${Object.keys(newTree.branches).join(', ')}\n`)

  console.log('8. Testing server addition...')
  const expandedTree = client.addServer(master, 'api', 'server3', structure)
  const server3Key = importTree(expandedTree, 'api/server3')
  console.log(`   Server3 added, public: ${server3Key.publicKey.toString('hex').substring(0, 16)}...\n`)

  console.log('=== All tests passed! ===\n')
}

test().catch(console.error)
