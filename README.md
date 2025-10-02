# Keyringer - Hierarchical Key Management System

Secure, P2P-enabled hierarchical key management for distributed server infrastructure with non-escalatable access control and automatic server bootstrapping.

## Quick Start

### Option 1: Run with npx (Easiest)

```bash
npx keyringer
```

### Option 2: Clone and Run Locally

```bash
git clone https://github.com/lanmower/keyringer.git
cd keyringer
npm install
npm start
```

The GUI opens at **http://localhost:3777** with both backend API and frontend UI.

###  2. Create Your Master Key

Open http://localhost:3777 in your browser and:
1. Click **"Create New"** to generate a fresh master key (saved to `./master.key`)
2. OR click **"Load Existing"** to use an existing master key

### 3. Organize Your Servers

1. **Add Categories** - Create logical groupings like "api", "db", "cache"
2. **Add Servers** - Within each category, add your servers (e.g., "server1", "server2")

### 4. Deploy Servers

1. Go to **"Step 3: Server Bootstrap"**
2. Select a category and server
3. Set a discovery secret (or auto-generate one)
4. Click **"Generate Bootstrap Script"**
5. Copy the script and run it on your target server

The server will automatically:
- Receive its cryptographic keys
- Announce itself on the P2P network
- Start aliveness monitoring
- Begin serving with derived sibling keys

### 5. Monitor Server Health

Click **"Check All Servers"** to see real-time status of all deployed servers with uptime, latency, and connectivity information.

## Key Features

### ✓ Hierarchical Key Derivation
```
Master Seed
  ↓
Category Seeds (hash-based derivation)
  ↓
Server Keypairs (deterministic generation)
```

### ✓ Non-Escalatable Security

Servers can:
- Derive ALL sibling keys in their category
- Sign and verify as their category
- Generate bearer tokens for authentication

Servers **cannot**:
- Access parent (master) keys
- Derive keys from other categories
- Escalate their privilege level

### ✓ P2P Discovery

Servers with the same discovery secret find each other automatically via DHT.

### ✓ Aliveness Monitoring

The wallet performs cryptographic health checks with ping, challenge-response, and status reports.

### ✓ Turnkey Deployment

One command deploys a fully configured server with keys, P2P discovery, and monitoring.

## Architecture

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete architectural documentation, security model, API reference, and production deployment guide.

## Testing

```bash
# Test complete bootstrap workflow
node test-bootstrap.js

# Test aliveness monitoring
node test-aliveness.js
```

## License

ISC
