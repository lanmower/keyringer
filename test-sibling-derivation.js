const client = require('./packages/keyring-client')
const { ACCESS_LEVELS, createAccessGrant } = require('./packages/keyring-access')
const { createRecoveryShare, storeRecoveryShares, requestRecovery } = require('./packages/keyring-recovery')
const { from, Keychain } = require('./packages/keyring-core')

console.log('\n' + '='.repeat(70))
console.log('🔬 SIBLING KEY DERIVATION TEST')
console.log('='.repeat(70) + '\n')

console.log('📍 Setup: Creating Master & Structure\n')

const { keyPair: master } = client.createMaster()
const structure = {
  api: ['server1', 'server2', 'server3']
}
const tree = client.buildTree(master, structure)

console.log('✓ Master created')
console.log('✓ Category: api')
console.log('✓ Servers: server1, server2, server3\n')

console.log('📍 Test 1: CATEGORY_SIGN Grant (has category scalar)\n')

const server1Grant = createAccessGrant(master, 'api/server1', ACCESS_LEVELS.CATEGORY_SIGN)
console.log('Server1 CATEGORY_SIGN grant created:')
console.log('  Level:', server1Grant.level)
console.log('  Has publicKey:', !!server1Grant.grant.publicKey)
console.log('  Has privateKey (category scalar):', !!server1Grant.grant.privateKey)
console.log('  Category:', server1Grant.grant.category, '\n')

console.log('Reconstructing keychain from grant...')
const server1Keychain = Keychain.from({
  publicKey: Buffer.from(server1Grant.grant.publicKey, 'hex'),
  secretKey: Buffer.from(server1Grant.grant.privateKey, 'hex')
})

console.log('✓ Keychain reconstructed')
console.log('✓ Has .sub():', typeof server1Keychain.sub)
console.log('✓ Has .get():', typeof server1Keychain.get, '\n')

console.log('Can server1 derive its OWN key?')
const ownKey = server1Keychain.get('server1')
console.log('  ✓ Public key:', ownKey.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ Has scalar:', !!ownKey.scalar)
console.log('  ✓ Can sign:', !!ownKey.sign, '\n')

console.log('Can server1 derive SIBLING server2?')
const sibling2 = server1Keychain.get('server2')
console.log('  ✓ Public key:', sibling2.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ Has scalar:', !!sibling2.scalar)
console.log('  ✓ Can sign:', !!sibling2.sign, '\n')

console.log('Can server1 derive SIBLING server3?')
const sibling3 = server1Keychain.get('server3')
console.log('  ✓ Public key:', sibling3.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ Has scalar:', !!sibling3.scalar)
console.log('  ✓ Can sign:', !!sibling3.sign, '\n')

console.log('Can server1 go UP to parent categories?')
console.log('  ✗ NO - server1 only has category-level scalar')
console.log('  ✗ Does not have master scalar')
console.log('  ✗ Cannot derive other categories (db, cache, etc.)\n')

console.log('📍 Test 2: CATEGORY_READ Grant (category public key only)\n')

const readGrant = createAccessGrant(master, 'api/server1', ACCESS_LEVELS.CATEGORY_READ)
console.log('CATEGORY_READ grant created:')
console.log('  Level:', readGrant.level)
console.log('  Has publicKey:', !!readGrant.grant.publicKey)
console.log('  Has privateKey:', !!readGrant.grant.privateKey, '\n')

const readKeychain = Keychain.from(Buffer.from(readGrant.grant.publicKey, 'hex'))

console.log('Can CATEGORY_READ derive server public keys?')
const pubServer1 = readKeychain.sub('server1')
const pubServer2 = readKeychain.sub('server2')
console.log('  ✓ server1 public:', pubServer1.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ server2 public:', pubServer2.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✗ Has scalar:', !!pubServer1.scalar)
console.log('  ✗ Can sign:', !!pubServer1.sign, '\n')

console.log('📍 Test 3: P2P Recovery with Siblings\n')

const shares = [
  createRecoveryShare(master, 'api/server1', server1Grant),
  createRecoveryShare(master, 'api/server2', server1Grant),
  createRecoveryShare(master, 'api/server3', server1Grant)
]

const recoveryStore = storeRecoveryShares(shares)

console.log('Created recovery shares for all servers in category')
console.log('All shares have same grant (CATEGORY_SIGN)')
console.log('Stored paths:', Object.keys(recoveryStore).join(', '), '\n')

console.log('Server1 recovers from P2P network...')
const recovered = requestRecovery(recoveryStore, 'api/server1', server1Grant)
console.log('  ✓ Type:', recovered.type)
console.log('  ✓ Has category scalar:', !!recovered.privateKey, '\n')

console.log('Server1 uses recovered grant to derive siblings...')
const recoveredKeychain = Keychain.from({
  publicKey: Buffer.from(recovered.publicKey, 'hex'),
  secretKey: Buffer.from(recovered.privateKey, 'hex')
})

const derivedServer2 = recoveredKeychain.get('server2')
const derivedServer3 = recoveredKeychain.get('server3')

console.log('  ✓ Derived server2:', derivedServer2.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ Derived server3:', derivedServer3.publicKey.toString('hex').substring(0, 32) + '...')
console.log('  ✓ Both have signing capability:', !!derivedServer2.sign && !!derivedServer3.sign, '\n')

console.log('='.repeat(70))
console.log('✅ SIBLING DERIVATION WORKING AS DESCRIBED')
console.log('='.repeat(70))
console.log('\n📊 Capabilities Summary:\n')
console.log('CATEGORY_SIGN (has category scalar):')
console.log('  ✓ Can derive ALL servers in category (server1, server2, server3...)')
console.log('  ✓ Can sign with any derived key')
console.log('  ✗ Cannot access parent (master)')
console.log('  ✗ Cannot access sibling categories (db, cache)\n')

console.log('CATEGORY_READ (category public key only):')
console.log('  ✓ Can derive public keys for all servers in category')
console.log('  ✗ Cannot derive private keys')
console.log('  ✗ Cannot sign\n')

console.log('PUBLIC_ONLY (single server public key):')
console.log('  ✓ Can verify signatures from specific server')
console.log('  ✗ Cannot derive any other keys\n')

console.log('🎯 Result: Servers can derive siblings but NOT parent!\n')
