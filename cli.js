#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

const args = process.argv.slice(2)
const command = args[0] || 'gui'

if (command === 'gui' || command === 'start') {
  console.log('Starting Keyringer GUI...')
  const guiPath = path.join(__dirname, 'gui')
  const proc = spawn('npm', ['start'], {
    cwd: guiPath,
    stdio: 'inherit',
    shell: true
  })

  proc.on('exit', (code) => {
    process.exit(code)
  })
} else if (command === '--help' || command === '-h') {
  console.log(`
Keyringer - Hierarchical Key Management & P2P Distribution

Usage:
  npx keyringer              Start the GUI (default)
  npx keyringer gui          Start the GUI
  npx keyringer --help       Show this help

Documentation: https://github.com/lanmower/keyringer
  `)
} else {
  console.error(`Unknown command: ${command}`)
  console.error('Run "npx keyringer --help" for usage information')
  process.exit(1)
}
