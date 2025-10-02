# Keyringer

Secure hierarchical key management and distribution system with P2P recovery.

## Features

- **Hierarchical Deterministic Keys**: Derive unlimited keys from a single master seed using keypear
- **Access Control**: 5-level permission system that prevents privilege escalation
- **P2P Recovery**: Servers can recover their keys from the network when the wallet is offline
- **Hyperdrive Distribution**: Share key trees efficiently via Hypercore Protocol
- **Web GUI**: Manage keys, grants, and distribution through an intuitive interface

## Security Model

### Access Levels

1. **NONE** (0): No access
2. **PUBLIC_ONLY** (1): Can verify signatures only
3. **CATEGORY_READ** (2): Can derive public keys within a category
4. **CATEGORY_SIGN** (3): Can sign with a specific server key
5. **FULL_CONTROL** (4): Master key access (wallet only)

### Key Principles

- **Non-escalatable**: Servers cannot grant themselves higher privileges
- **Path-bound**: Access is restricted to specific category/server paths
- **Encrypted Recovery**: Keys are distributed encrypted to authorized recipients
- **P2P Resilience**: Network continues operating without the master wallet

## Architecture

```
keyringer/
├── packages/
│   ├── keyring-core/       # Key derivation (keypear wrapper)
│   ├── keyring-auth/       # Challenge-response authentication
│   ├── keyring-tree/       # Key tree management
│   ├── keyring-server/     # DHT-based P2P server
│   ├── keyring-client/     # Client API
│   ├── keyring-access/     # Access control system
│   ├── keyring-drive/      # Hyperdrive distribution
│   └── keyring-recovery/   # P2P recovery mechanism
├── gui/                    # Web management interface
└── tests/                  # E2E test suites
```

## Quick Start

### Installation

```bash
npm install
```

### Running Tests

```bash
# Test core functionality
npm test

# Test recovery and access control
node test-recovery.js
```

### Starting the GUI

```bash
cd gui
npm start
```

Then open http://localhost:3777 in your browser.

## GUI Workflow

1. **Create or Load Master Key**
   - Click "Create New" to generate a new master seed
   - Click "Load Existing" to load from `master.key`

2. **Build Key Structure**
   - Add categories (e.g., "api", "db", "cache")
   - Add servers within each category (e.g., "server1", "server2")

3. **Create Access Grants**
   - Specify path (e.g., "api/server1")
   - Select access level
   - Grant is created with appropriate permissions

4. **Distribute via Hyperdrive**
   - Click "Create Drive" to package the key tree
   - Share the drive key with your network
   - Servers can sync keys from the Hyperdrive

5. **Audit Keys**
   - View all derived keys and their public keys
   - Verify the key hierarchy
   - Check permissions

## Use Cases

### Scenario: Multi-Server Application

You have an application running on multiple servers that need cryptographic keys:

1. **Wallet (dev machine)**: Holds master key, creates structure
2. **API Servers**: Need signing capability for their specific keys
3. **DB Servers**: Need different keys for data encryption
4. **Cache Servers**: Only need public keys for verification

The wallet distributes keys with appropriate access levels. When the wallet goes offline, servers can recover their keys from each other via P2P, but no server can access keys it wasn't granted.

### Scenario: Key Rotation

When rotating a category:

```javascript
const newTree = client.rotateCategory(master, 'api', 'api-v2', structure)
```

All servers in the old category get new keys, and the old keys are marked for deprecation.

## API Examples

### Creating a Master Key

```javascript
const { createMaster } = require('./packages/keyring-client')

const { seed, keyPair: master } = createMaster()
console.log('Master seed:', seed)
```

### Building a Key Tree

```javascript
const { buildTree } = require('./packages/keyring-client')

const structure = {
  api: ['server1', 'server2'],
  db: ['primary', 'replica']
}

const tree = buildTree(master, structure)
```

### Creating Access Grants

```javascript
const { ACCESS_LEVELS, createAccessGrant } = require('./packages/keyring-access')

const grant = createAccessGrant(
  master,
  'api/server1',
  ACCESS_LEVELS.CATEGORY_SIGN
)
```

### P2P Recovery

```javascript
const { createRecoveryShare, storeRecoveryShares, requestRecovery } = require('./packages/keyring-recovery')

// Wallet creates shares
const shares = [
  createRecoveryShare(master, 'api/server1', server1Grant),
  createRecoveryShare(master, 'api/server2', server2Grant)
]

// Store in P2P network
const store = storeRecoveryShares(shares)

// Server recovers its key (wallet offline)
const recovered = requestRecovery(store, 'api/server1', server1Grant)
```

## Dependencies

- **keypear**: Hierarchical Ed25519 key derivation
- **hypercore-crypto**: Cryptographic primitives
- **hyperdrive**: P2P file distribution
- **hyperdht**: Distributed hash table for P2P networking
- **express**: Web server for GUI
- **ws**: WebSocket support

## Security Considerations

- **Master Key Protection**: The master seed must be kept secure - it can derive all keys
- **Grant Verification**: Always verify access grants match intended permissions
- **Path Validation**: Ensure paths are properly formatted (category/server)
- **Recovery Shares**: Shares are stored with minimal access - servers only get what they need
- **No Privilege Escalation**: By design, servers cannot grant themselves higher permissions

## Testing

The system includes comprehensive tests:

- `test-e2e.js`: Core functionality (key derivation, auth, tokens)
- `test-recovery.js`: Access control and P2P recovery

All tests verify:
- ✓ Access levels enforced
- ✓ Privilege escalation prevented
- ✓ Recovery shares working
- ✓ Servers cannot access unauthorized keys
- ✓ P2P recovery functional without master key

## License

MIT
