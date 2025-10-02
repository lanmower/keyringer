# Keyringer Server Deployment Guide

## Overview

Keyringer is a hierarchical key management system with P2P distribution, designed for secure server-to-server key sharing without privilege escalation.

## System Architecture

```
Master Wallet (GUI)
    ↓ derives
Category Seeds (per category: api, db, etc.)
    ↓ derives
Server Keys (individual servers)
```

### Key Features

- **Non-escalatable Access**: Servers can derive sibling keys but never parent keys
- **P2P Discovery**: Servers find each other using discovery secrets
- **Aliveness Monitoring**: Wallet can check server health via P2P
- **Hyperdrive Distribution**: Keys synced via P2P filesystem
- **Flatfile Export**: Keys can be exported to traditional filesystem

## Quick Start

### 1. Start the Wallet GUI

```bash
cd gui
npm install
npm start  # Backend on port 3777

cd wallet-ui
npm install
npm run dev  # Frontend on port 5173
```

Open http://localhost:5173 in your browser.

### 2. Initialize Master Key

In the GUI:
1. Click "Create New" to generate a new master key
2. OR click "Load Existing" to load from `./master.key`
3. The master seed is automatically saved

### 3. Set Up Key Structure

1. Add categories (e.g., "api", "db", "cache")
2. Add servers to each category (e.g., "server1", "server2")
3. Each server gets a unique derived key

### 4. Generate Bootstrap Script

1. Navigate to "Server Bootstrap" section
2. Select category and server
3. Enter a discovery secret (or auto-generate one)
4. Click "Generate Bootstrap Script"
5. Copy the script to your server

### 5. Deploy to Server

On your server:

```bash
# Paste the bootstrap script
chmod +x bootstrap.sh
./bootstrap.sh
```

This will:
- Install dependencies
- Create `keyring-config/` directory
- Save server configuration
- Start the server with aliveness monitoring
- Announce to P2P discovery network

## Security Model

### Access Levels

```
0. NONE - No access
1. PUBLIC_ONLY - Can verify signatures only
2. CATEGORY_READ - Can read category public keys
3. CATEGORY_SIGN - Can sign as category + derive ALL sibling keys
4. FULL_CONTROL - Has master seed (wallet only)
```

### Category Seed Derivation

```javascript
categorySeed = hash(masterSeed + categoryName)
```

This ensures:
- Same category = same seed
- Different categories = different seeds
- Cannot derive master from category seed
- Can derive all siblings from category seed

### Server Key Derivation

```javascript
serverKeyPair = categoryKeychain.get(serverName)
```

This ensures:
- Deterministic server keys
- Servers with CATEGORY_SIGN can derive siblings
- Cannot derive keys from other categories

## P2P Discovery

### Discovery Secrets

Servers use a shared secret to find each other:

```javascript
discoveryTopic = hash(discoverySecret)
```

All servers with the same discovery secret can find each other via DHT.

### Using Custom Discovery Secrets

Option 1: Auto-generated (recommended for testing)
```
keyringer-api-1730524800000
```

Option 2: Custom (recommended for production)
```
mycompany-production-network-2025
```

⚠️ **Security Note**: Keep discovery secrets confidential. Anyone with the secret can discover your servers on the network.

## Aliveness Checks

The wallet can monitor server health:

1. Click "Check All Servers" in the GUI
2. Servers respond with:
   - Status (online/offline)
   - Uptime
   - Category and server name
   - Public key

Check types:
- **ping**: Simple connectivity check
- **challenge**: Cryptographic signature verification
- **status**: Full server status report

## Hyperdrive Distribution

### Create Drive

```javascript
// In GUI
POST /api/drive/create
```

This creates a Hyperdrive containing:
- Full key tree
- All access grants
- P2P-shareable drive key

### Sync to Flatfiles

```javascript
// In GUI
POST /api/drive/sync
{ "targetDir": "./key-flatfiles" }
```

Creates filesystem structure:
```
key-flatfiles/
  manifest.json          # Full manifest
  keys/
    api/
      public.key         # Category public key
      server1/
        public.key       # Server public key
      server2/
        public.key
    db/
      public.key
      primary/
        public.key
  grants/
    api_server1.json     # Access grants
    db_primary.json
```

## Server Configuration

Bootstrap creates `keyring-config/server-config.json`:

```json
{
  "category": "api",
  "serverName": "server1",
  "categorySeed": "dbad434e778606d6fc7d580845d5e8ca...",
  "publicKey": "e9b0e6d80671d79867d55c609bafe8ad...",
  "discoverySecret": "keyringer-production-2025",
  "path": "api/server1"
}
```

### Using the Config

```javascript
const { bootstrapFromConfig } = require('@keyringer/bootstrap')

const server = await bootstrapFromConfig('./keyring-config')
// Server is now running with:
// - Aliveness monitoring
// - P2P discovery announcement
// - Category-level key derivation
```

## Testing

Run comprehensive tests:

```bash
# Test core functionality
node test-full-system.js

# Test aliveness checks
node test-aliveness.js

# Test sibling derivation
node test-sibling-derivation.js

# Test bootstrap workflow
node test-bootstrap.js
```

## API Endpoints

### Master Key Management
```
POST /api/init           # Create new master key
POST /api/load           # Load existing master key
GET  /api/keys/full      # Export all keys (sensitive!)
```

### Structure Management
```
GET    /api/structure              # Get current structure
POST   /api/category               # Add category
POST   /api/server                 # Add server to category
DELETE /api/server/:cat/:server    # Remove server
```

### Access Control
```
POST /api/grant           # Create access grant
GET  /api/audit           # Generate audit log
```

### Hyperdrive
```
POST /api/drive/create    # Create new drive
POST /api/drive/grant     # Add grant to drive
POST /api/drive/sync      # Sync to flatfiles
```

### Bootstrap
```
POST /api/bootstrap/script  # Generate bootstrap script
```

### Aliveness
```
POST /api/aliveness/check   # Check single server
POST /api/aliveness/bulk    # Check all servers
```

## Production Deployment Checklist

- [ ] Generate secure master key
- [ ] Backup master seed securely (offline storage)
- [ ] Define category structure
- [ ] Generate unique discovery secret per environment
- [ ] Bootstrap all servers with proper configs
- [ ] Verify aliveness checks work
- [ ] Test sibling key derivation
- [ ] Set up Hyperdrive replication
- [ ] Configure access grants
- [ ] Test P2P recovery workflow
- [ ] Document category seed backups
- [ ] Restrict wallet access (dev only)

## Security Best Practices

1. **Master Seed**: Store offline in secure vault
2. **Discovery Secrets**: One per environment (dev/staging/prod)
3. **Category Seeds**: Backup separately, encrypted
4. **Wallet Access**: Developer-only, never production servers
5. **Server Configs**: Protect `server-config.json` files
6. **Network**: Use VPN/private networks for P2P discovery
7. **Rotation**: Plan for key rotation procedures

## Troubleshooting

### Server Not Found
- Check discovery secret matches
- Verify DHT bootstrapping (may take 30-60s)
- Ensure servers are on same network

### Aliveness Check Fails
- Verify server is running
- Check firewall rules (UDP for DHT)
- Confirm public key matches

### Sibling Derivation Fails
- Ensure category seed is correct
- Verify keychain reconstruction
- Check server name matches exactly

### Bootstrap Script Fails
- Install required packages
- Check Node.js version (v18+)
- Verify file permissions

## Package Structure

```
packages/
  keyring-core/         # Seed derivation, key generation
  keyring-access/       # Access control, grant management
  keyring-aliveness/    # P2P health monitoring
  keyring-bootstrap/    # Server deployment automation
  keyring-client/       # High-level client API
  keyring-drive/        # Hyperdrive distribution
  keyring-recovery/     # P2P key recovery
  keyring-server/       # Server-side components
```

## Architecture Diagrams

### Key Derivation Hierarchy
```
Master Seed (32 bytes)
    ↓ hash(masterSeed + "api")
API Category Seed (32 bytes)
    ↓ keychain.get("server1")
Server1 KeyPair
    - publicKey (for verification)
    - scalar/privateKey (for signing)
```

### P2P Discovery Flow
```
1. Server announces to DHT topic
   topic = hash(discoverySecret)

2. Other servers lookup same topic

3. DHT returns list of public keys

4. Servers connect directly via DHT

5. Aliveness checks verify identity
```

### Bootstrap Workflow
```
Wallet (GUI)
    ↓ generates
Bootstrap Script
    ↓ executes on server
Server Config + Aliveness Server + DHT Announcement
    ↓ allows
P2P Discovery + Sibling Key Derivation + Health Monitoring
```

## License

ISC
