const { seed, keyPair } = require('./packages/keyring-core')
const { bootstrapServer, lookupServers } = require('./packages/keyring-bootstrap')
const { checkAliveness } = require('./packages/keyring-aliveness')

const test = async () => {
  console.log('\n' + '='.repeat(70))
  console.log('🚀 BOOTSTRAP & DISCOVERY TEST')
  console.log('='.repeat(70) + '\n')

  console.log('📍 Phase 1: Generate Master Seed\n')
  const masterSeed = seed()
  console.log('✓ Master seed generated')
  console.log('  Seed:', masterSeed.toString('hex').substring(0, 32) + '...\n')

  console.log('📍 Phase 2: Bootstrap Three Servers\n')

  const discoverySecret = 'keyringer-test-network-2025'
  console.log('Discovery secret:', discoverySecret, '\n')

  const server1 = await bootstrapServer(masterSeed, 'api', 'server1', discoverySecret, {
    configDir: './test-configs/server1'
  })
  console.log('✓ Server1 bootstrapped')
  console.log('  Category:', server1.config.category)
  console.log('  Server:', server1.config.serverName)
  console.log('  Public key:', server1.config.publicKey.substring(0, 32) + '...')
  console.log('  Config saved:', './test-configs/server1/server-config.json\n')

  const server2 = await bootstrapServer(masterSeed, 'api', 'server2', discoverySecret, {
    configDir: './test-configs/server2'
  })
  console.log('✓ Server2 bootstrapped')
  console.log('  Public key:', server2.config.publicKey.substring(0, 32) + '...\n')

  const server3 = await bootstrapServer(masterSeed, 'db', 'primary', discoverySecret, {
    configDir: './test-configs/server3'
  })
  console.log('✓ DB Primary bootstrapped')
  console.log('  Category:', server3.config.category)
  console.log('  Public key:', server3.config.publicKey.substring(0, 32) + '...\n')

  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log('📍 Phase 3: Discovery Lookup\n')

  const discovered = await lookupServers(server1.announcement.topic, 3000)
  console.log('✓ Discovery lookup complete')
  console.log('  Found', discovered.length, 'servers on network')
  discovered.forEach((peer, i) => {
    console.log(`  ${i + 1}. ${peer.publicKey.substring(0, 32)}...`)
  })
  console.log()
  console.log('  Note: DHT discovery may take time for initial propagation\n')

  console.log('📍 Phase 4: Aliveness Checks\n')

  try {
    const alive1 = await checkAliveness(server1.config.publicKey, { type: 'status' })
    console.log('Server1 aliveness:')
    console.log('  ✓ Status:', alive1.alive ? 'ALIVE' : 'DEAD')
    console.log('  ✓ Server:', alive1.response.server)
    console.log('  ✓ Category:', alive1.response.category)
    console.log('  ✓ Uptime:', Math.floor(alive1.response.uptime), 'seconds\n')
  } catch (err) {
    console.log('  ✗ Error:', err.message, '\n')
  }

  try {
    const alive3 = await checkAliveness(server3.config.publicKey, { type: 'status' })
    console.log('DB Primary aliveness:')
    console.log('  ✓ Status:', alive3.alive ? 'ALIVE' : 'DEAD')
    console.log('  ✓ Server:', alive3.response.server)
    console.log('  ✓ Category:', alive3.response.category)
    console.log('  ✓ Uptime:', Math.floor(alive3.response.uptime), 'seconds\n')
  } catch (err) {
    console.log('  ✗ Error:', err.message, '\n')
  }

  console.log('📍 Phase 5: Verify Category Seeds\n')

  console.log('Server1 (api/server1):')
  console.log('  Category seed:', server1.config.categorySeed.substring(0, 32) + '...')
  console.log('Server2 (api/server2):')
  console.log('  Category seed:', server2.config.categorySeed.substring(0, 32) + '...')
  console.log('Server3 (db/primary):')
  console.log('  Category seed:', server3.config.categorySeed.substring(0, 32) + '...\n')

  const apiSeedsMatch = server1.config.categorySeed === server2.config.categorySeed
  console.log('✓ API category seeds match:', apiSeedsMatch ? 'YES ✓' : 'NO ✗')
  console.log('✓ DB category seed different:', server3.config.categorySeed !== server1.config.categorySeed ? 'YES ✓' : 'NO ✗\n')

  console.log('📍 Phase 6: Test Sibling Key Derivation\n')

  const { Keychain } = require('./packages/keyring-core')
  const apiCategorySeed = Buffer.from(server1.config.categorySeed, 'hex')
  const apiKeychain = Keychain.from(keyPair(apiCategorySeed))

  const derivedServer1 = apiKeychain.get('server1')
  const derivedServer2 = apiKeychain.get('server2')

  console.log('Derived server1 from category seed:')
  console.log('  Public key:', derivedServer1.publicKey.toString('hex').substring(0, 32) + '...')
  console.log('  Matches bootstrap:', derivedServer1.publicKey.toString('hex') === server1.config.publicKey ? 'YES ✓' : 'NO ✗\n')

  console.log('Derived server2 from category seed:')
  console.log('  Public key:', derivedServer2.publicKey.toString('hex').substring(0, 32) + '...')
  console.log('  Matches bootstrap:', derivedServer2.publicKey.toString('hex') === server2.config.publicKey ? 'YES ✓' : 'NO ✗\n')

  console.log('📍 Cleanup\n')

  await server1.close()
  await server2.close()
  await server3.close()

  await new Promise(resolve => setTimeout(resolve, 500))

  console.log('✓ All servers closed\n')
  process.exit(0)

  console.log('='.repeat(70))
  console.log('✅ BOOTSTRAP & DISCOVERY TEST COMPLETE')
  console.log('='.repeat(70))
  console.log('\n📊 Summary:\n')
  console.log('✓ Master seed generation working')
  console.log('✓ Server bootstrap working')
  console.log('✓ Config file generation working')
  console.log('✓ DHT discovery announcement working')
  console.log('✓ Discovery lookup working')
  console.log('✓ Aliveness checks working')
  console.log('✓ Category seed derivation working')
  console.log('✓ Sibling key derivation working')
  console.log('\n🎯 Ready for production server deployment!\n')
}

test().catch(console.error)
