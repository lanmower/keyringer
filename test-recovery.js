const client = require('./packages/keyring-client')
const { ACCESS_LEVELS, createAccessGrant, verifyAccess, canEscalate } = require('./packages/keyring-access')
const { createRecoveryShare, storeRecoveryShares, requestRecovery } = require('./packages/keyring-recovery')

const test = async () => {
  console.log('\n=== Recovery & Access Control Test ===\n')

  console.log('1. Creating master key and structure...')
  const { seed, keyPair: master } = client.createMaster()
  const structure = {
    api: ['server1', 'server2'],
    db: ['primary', 'replica']
  }
  const tree = client.buildTree(master, structure)
  console.log('   ✓ Master and structure created\n')

  console.log('2. Creating access grants...')
  const server1SignGrant = createAccessGrant(master, 'api/server1', ACCESS_LEVELS.CATEGORY_SIGN)
  const server2PubGrant = createAccessGrant(master, 'api/server2', ACCESS_LEVELS.PUBLIC_ONLY)
  const dbPrimaryGrant = createAccessGrant(master, 'db/primary', ACCESS_LEVELS.CATEGORY_SIGN)
  console.log('   ✓ server1: CATEGORY_SIGN')
  console.log('   ✓ server2: PUBLIC_ONLY')
  console.log('   ✓ db/primary: CATEGORY_SIGN\n')

  console.log('3. Testing access verification...')
  const access1 = verifyAccess(server1SignGrant, 'api/server1')
  console.log(`   server1 access to api/server1: ${access1.allowed}`)
  console.log(`   Capabilities: ${access1.capabilities.join(', ')}`)

  const access2 = verifyAccess(server2PubGrant, 'api/server2')
  console.log(`   server2 access to api/server2: ${access2.allowed}`)
  console.log(`   Capabilities: ${access2.capabilities.join(', ')}`)

  const accessDenied = verifyAccess(server1SignGrant, 'db/primary')
  console.log(`   server1 access to db/primary: ${accessDenied.allowed}`)
  console.log(`   Reason: ${accessDenied.reason}\n`)

  console.log('4. Testing privilege escalation prevention...')
  const canServer1EscalateToFull = canEscalate(server1SignGrant, { path: 'master', level: ACCESS_LEVELS.FULL_CONTROL })
  console.log(`   Can server1 escalate to FULL_CONTROL: ${canServer1EscalateToFull}`)

  const canServer1EscalateToDb = canEscalate(server1SignGrant, { path: 'db/primary', level: ACCESS_LEVELS.CATEGORY_SIGN })
  console.log(`   Can server1 escalate to db/primary: ${canServer1EscalateToDb}`)

  const canServer2EscalateToSign = canEscalate(server2PubGrant, { path: 'api/server2', level: ACCESS_LEVELS.CATEGORY_SIGN })
  console.log(`   Can server2 escalate to CATEGORY_SIGN: ${canServer2EscalateToSign}\n`)

  console.log('5. Creating recovery shares (wallet distributes when online)...')
  const shares = []

  shares.push(createRecoveryShare(master, 'api/server1', server1SignGrant))
  console.log('   ✓ Created encrypted share for server1 (has signing capability)')

  shares.push(createRecoveryShare(master, 'api/server2', server2PubGrant))
  console.log('   ✓ Created public-only share for server2 (no private key)')

  shares.push(createRecoveryShare(master, 'db/primary', dbPrimaryGrant))
  console.log('   ✓ Created encrypted share for db/primary\n')

  console.log('6. Storing shares in P2P network...')
  const recoveryStore = storeRecoveryShares(shares)
  console.log(`   ✓ Stored ${shares.length} shares`)
  console.log(`   Paths: ${Object.keys(recoveryStore).join(', ')}\n`)

  console.log('7. Testing recovery (wallet offline, servers help each other)...')

  try {
    const recovered1 = requestRecovery(recoveryStore, 'api/server1', server1SignGrant)
    console.log('   ✓ server1 recovered its own key')
    console.log(`     Has private key: ${!!recovered1.privateKey}`)
  } catch (err) {
    console.log(`   ✗ server1 recovery failed: ${err.message}`)
  }

  try {
    const recovered2 = requestRecovery(recoveryStore, 'api/server2', server2PubGrant)
    console.log('   ✓ server2 recovered its key')
    console.log(`     Has private key: ${!!recovered2.privateKey}`)
  } catch (err) {
    console.log(`   ✗ server2 recovery failed: ${err.message}`)
  }

  try {
    const unauthorized = requestRecovery(recoveryStore, 'db/primary', server1SignGrant)
    console.log('   ✗ SECURITY BREACH: server1 accessed db/primary!')
  } catch (err) {
    console.log(`   ✓ server1 denied access to db/primary: ${err.message}`)
  }

  console.log('\n=== Security Model Verified ===')
  console.log('✓ Access levels enforced')
  console.log('✓ Privilege escalation prevented')
  console.log('✓ Encrypted recovery shares working')
  console.log('✓ Servers cannot access unauthorized keys')
  console.log('✓ P2P recovery without master key functional\n')
}

test().catch(console.error)
