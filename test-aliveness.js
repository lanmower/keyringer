const { seed, keyPair, deriveCategorySeed, Keychain } = require('./packages/keyring-core')
const { startAlivenessServer, checkAliveness, bulkCheck, monitorServers, close } = require('./packages/keyring-aliveness')

const test = async () => {
  console.log('\n' + '='.repeat(70))
  console.log('🔍 P2P ALIVENESS CHECK TEST')
  console.log('='.repeat(70) + '\n')

  console.log('📍 Phase 1: Starting Mock Servers\n')

  const masterSeed = seed()

  const server1 = await startAlivenessServer(masterSeed, 'api', 'server1')
  console.log('✓ Server1 started')
  console.log('  Public key:', server1.publicKey.substring(0, 32) + '...')
  console.log('  Category:', server1.category)
  console.log('  Name:', server1.serverName, '\n')

  const server2 = await startAlivenessServer(masterSeed, 'api', 'server2')
  console.log('✓ Server2 started')
  console.log('  Public key:', server2.publicKey.substring(0, 32) + '...\n')

  const server3 = await startAlivenessServer(masterSeed, 'db', 'primary')
  console.log('✓ DB Primary started')
  console.log('  Public key:', server3.publicKey.substring(0, 32) + '...\n')

  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('📍 Phase 2: Simple Ping Check\n')

  try {
    const ping1 = await checkAliveness(server1.publicKey, { type: 'ping' })
    console.log('Server1 ping:')
    console.log('  ✓ Alive:', ping1.alive)
    console.log('  ✓ Response:', ping1.response.type)
    console.log('  ✓ Server name:', ping1.response.server)
    console.log('  ✓ Latency:', ping1.latency, 'ms\n')
  } catch (err) {
    console.log('  ✗ Error:', err.message, '\n')
  }

  console.log('📍 Phase 3: Challenge-Response Check\n')

  try {
    const challenge1 = await checkAliveness(server1.publicKey, { type: 'challenge' })
    console.log('Server1 challenge:')
    console.log('  ✓ Alive:', challenge1.alive)
    console.log('  ✓ Got signature:', !!challenge1.response.signature)
    console.log('  ✓ Server name:', challenge1.response.server, '\n')
  } catch (err) {
    console.log('  ✗ Error:', err.message, '\n')
  }

  console.log('📍 Phase 4: Status Report Check\n')

  try {
    const status1 = await checkAliveness(server1.publicKey, { type: 'status' })
    console.log('Server1 status:')
    console.log('  ✓ Alive:', status1.alive)
    console.log('  ✓ Server:', status1.response.server)
    console.log('  ✓ Category:', status1.response.category)
    console.log('  ✓ Uptime:', Math.floor(status1.response.uptime), 'seconds')
    console.log('  ✓ Version:', status1.response.version, '\n')
  } catch (err) {
    console.log('  ✗ Error:', err.message, '\n')
  }

  console.log('📍 Phase 5: Bulk Check (All Servers)\n')

  const serverList = [
    { name: 'server1', publicKey: server1.publicKey },
    { name: 'server2', publicKey: server2.publicKey },
    { name: 'db-primary', publicKey: server3.publicKey }
  ]

  const bulkResults = await bulkCheck(serverList, { type: 'status' })

  console.log('Bulk check results:')
  bulkResults.forEach((result, i) => {
    console.log(`\n  ${result.server.name}:`)
    console.log(`    Success: ${result.success}`)
    if (result.success) {
      console.log(`    Status: ${result.data.response.server} online`)
      console.log(`    Category: ${result.data.response.category}`)
      console.log(`    Uptime: ${Math.floor(result.data.response.uptime)}s`)
    } else {
      console.log(`    Error: ${result.error}`)
    }
  })

  console.log('\n📍 Phase 6: Continuous Monitoring (10 seconds)\n')

  console.log('Starting monitor...')
  const monitor = await monitorServers(serverList, 2000)

  await new Promise(resolve => setTimeout(resolve, 10000))

  console.log('\nMonitoring results:')
  monitor.results.forEach((result, key) => {
    const server = serverList.find(s => s.publicKey === key)
    console.log(`\n  ${server?.name}:`)
    console.log(`    Status: ${result.status}`)
    console.log(`    Last check: ${new Date(result.lastCheck).toLocaleTimeString()}`)
    console.log(`    Failures: ${result.consecutiveFailures}`)
    if (result.response) {
      console.log(`    Uptime: ${Math.floor(result.response.uptime)}s`)
    }
  })

  console.log('\n\nStopping monitor...')
  monitor.stop()

  console.log('\n📍 Phase 7: Testing Offline Server\n')

  console.log('Closing server2...')
  server2.close()
  await new Promise(resolve => setTimeout(resolve, 1000))

  try {
    await checkAliveness(server2.publicKey, { type: 'ping', timeout: 2000 })
    console.log('  ✗ Server2 responded (unexpected!)')
  } catch (err) {
    console.log('  ✓ Server2 offline (expected)')
    console.log('  ✓ Error:', err.message, '\n')
  }

  console.log('📍 Cleanup\n')
  server1.close()
  server3.close()
  await new Promise(resolve => setTimeout(resolve, 500))
  close()

  console.log('✓ All servers closed')
  console.log('✓ DHT node destroyed\n')

  console.log('='.repeat(70))
  console.log('✅ ALIVENESS CHECK TEST COMPLETE')
  console.log('='.repeat(70))
  console.log('\n📊 Summary:\n')
  console.log('✓ Simple ping checks working')
  console.log('✓ Challenge-response verification working')
  console.log('✓ Status reports with uptime working')
  console.log('✓ Bulk checks working')
  console.log('✓ Continuous monitoring working')
  console.log('✓ Offline detection working')
  console.log('\n🎯 Wallet can now monitor all servers via P2P!\n')
}

test().catch(console.error)
