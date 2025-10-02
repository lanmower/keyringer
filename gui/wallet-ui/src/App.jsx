import { useState, useEffect } from 'react'
import { Key, Shield, Database, Network, FileKey, ChevronDown, ChevronUp, Plus, Trash2, Eye, EyeOff, Copy, Download, Activity, Code, Info } from 'lucide-react'

const ACCESS_LEVELS = {
  0: { name: 'NONE', color: 'text-gray-500' },
  1: { name: 'PUBLIC_ONLY', color: 'text-blue-400' },
  2: { name: 'CATEGORY_READ', color: 'text-green-400' },
  3: { name: 'CATEGORY_SIGN', color: 'text-yellow-400' },
  4: { name: 'FULL_CONTROL', color: 'text-red-400' }
}

const HelpBox = ({ children }) => (
  <div style={{
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#93c5fd'
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <Info size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  </div>
)

function App() {
  const [masterStatus, setMasterStatus] = useState(null)
  const [structure, setStructure] = useState({})
  const [grants, setGrants] = useState([])
  const [driveKey, setDriveKey] = useState('')
  const [auditReport, setAuditReport] = useState('')
  const [showAudit, setShowAudit] = useState(false)
  const [fullKeys, setFullKeys] = useState(null)
  const [showKeys, setShowKeys] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState({})
  const [bootstrapScript, setBootstrapScript] = useState('')
  const [showBootstrap, setShowBootstrap] = useState(false)
  const [alivenessResults, setAlivenessResults] = useState([])
  const [showAliveness, setShowAliveness] = useState(false)

  const [categoryInput, setCategoryInput] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [serverInput, setServerInput] = useState('')
  const [grantPath, setGrantPath] = useState('')
  const [grantLevel, setGrantLevel] = useState('1')
  const [bootstrapCategory, setBootstrapCategory] = useState('')
  const [bootstrapServer, setBootstrapServer] = useState('')
  const [discoverySecret, setDiscoverySecret] = useState('')

  useEffect(() => {
    fetchStructure()
  }, [])

  const fetchStructure = async () => {
    const res = await fetch('/api/structure')
    const data = await res.json()
    setStructure(data.structure || {})
  }

  const initMaster = async () => {
    const res = await fetch('/api/init', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setMasterStatus({ type: 'success', message: `Created: ${data.publicKey.substring(0, 16)}...` })
    } else {
      setMasterStatus({ type: 'error', message: data.error })
    }
  }

  const loadMaster = async () => {
    const res = await fetch('/api/load', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setMasterStatus({ type: 'success', message: `Loaded: ${data.publicKey.substring(0, 16)}...` })
    } else {
      setMasterStatus({ type: 'error', message: data.error })
    }
  }

  const addCategory = async () => {
    if (!categoryInput.trim()) return
    const res = await fetch('/api/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: categoryInput.trim() })
    })
    const data = await res.json()
    setStructure(data.structure)
    setCategoryInput('')
  }

  const addServer = async () => {
    if (!selectedCategory || !serverInput.trim()) return
    const res = await fetch('/api/server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selectedCategory, server: serverInput.trim() })
    })
    const data = await res.json()
    setStructure(data.structure)
    setServerInput('')
  }

  const removeServer = async (category, server) => {
    const res = await fetch(`/api/server/${category}/${server}`, { method: 'DELETE' })
    const data = await res.json()
    setStructure(data.structure)
  }

  const createGrant = async () => {
    if (!grantPath.trim()) return
    const res = await fetch('/api/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: grantPath.trim(), level: parseInt(grantLevel) })
    })
    const data = await res.json()
    if (data.success) {
      setGrants([...grants, { path: grantPath, level: parseInt(grantLevel), grant: data.grant }])
      setGrantPath('')
    }
  }

  const createDrive = async () => {
    const res = await fetch('/api/drive/create', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setDriveKey(data.driveKey)
    }
  }

  const generateAudit = async () => {
    const res = await fetch('/api/audit')
    const data = await res.json()
    if (data.report) {
      setAuditReport(data.report)
      setShowAudit(true)
    }
  }

  const loadFullKeys = async () => {
    const res = await fetch('/api/keys/full')
    const data = await res.json()
    if (!data.error) {
      setFullKeys(data)
      setShowKeys(true)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const toggleReveal = (path) => {
    setRevealedKeys(prev => ({ ...prev, [path]: !prev[path] }))
  }

  const maskKey = (key, revealed) => {
    if (revealed) return key
    return key.substring(0, 8) + '...' + key.substring(key.length - 8)
  }

  const generateBootstrap = async () => {
    const res = await fetch('/api/bootstrap/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: bootstrapCategory,
        server: bootstrapServer,
        discoverySecret: discoverySecret || undefined
      })
    })
    const data = await res.json()
    if (data.script) {
      setBootstrapScript(data.script)
      setShowBootstrap(true)
      if (!discoverySecret) {
        setDiscoverySecret(data.discoverySecret)
      }
    }
  }

  const checkServerAliveness = async () => {
    const res = await fetch('/api/aliveness/bulk', { method: 'POST' })
    const data = await res.json()
    if (data.results) {
      setAlivenessResults(data.results)
      setShowAliveness(true)
    }
  }

  const syncDriveToFiles = async () => {
    const res = await fetch('/api/drive/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDir: './key-flatfiles' })
    })
    const data = await res.json()
    if (data.success) {
      alert('Drive synced to flatfiles successfully!')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Key className="w-12 h-12 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Keyringer
            </h1>
          </div>
          <p className="text-gray-400">Hierarchical Key Management & P2P Distribution</p>
        </header>

        <HelpBox>
          <strong>Welcome to Keyringer!</strong> This wallet manages your server keys hierarchically. Start by creating or loading a master key, then organize servers into categories (e.g., "api", "db"). Finally, generate bootstrap scripts to deploy servers with automatic P2P discovery and aliveness monitoring.
        </HelpBox>

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Step 1: Master Key</h2>
          </div>
          <HelpBox>
            The master key is the root of your entire hierarchy. <strong>Create New</strong> generates a fresh master seed (saved to ./master.key). <strong>Load Existing</strong> reads from an existing master.key file. <strong>View All Keys</strong> shows all derived seeds and keys (use only on secure devices).
          </HelpBox>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={initMaster} className="btn-primary flex-1">Create New</button>
            <button onClick={loadMaster} className="btn-primary flex-1">Load Existing</button>
            <button onClick={loadFullKeys} className="btn-primary flex-1">
              <Eye className="w-4 h-4 inline mr-1" /> View All Keys
            </button>
          </div>
          {masterStatus && (
            <div className={`mt-4 p-3 rounded-lg ${masterStatus.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
              {masterStatus.message}
            </div>
          )}
        </section>

        {showKeys && fullKeys && (
          <section className="glass p-6">
            <button
              onClick={() => setShowKeys(!showKeys)}
              className="flex items-center justify-between w-full text-xl font-semibold mb-4"
            >
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                <span>Full Key Export (SENSITIVE)</span>
              </div>
              {showKeys ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showKeys && (
              <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400 font-semibold">⚠️ WARNING: These are your private keys!</p>
                  <p className="text-sm text-gray-400 mt-1">Only reveal on secure devices. Anyone with these seeds can derive all keys.</p>
                </div>

                <div className="bg-black/40 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-primary">Master Seed</span>
                    <div className="flex gap-2">
                      <button onClick={() => toggleReveal('master')} className="text-sm text-gray-400 hover:text-primary">
                        {revealedKeys['master'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => copyToClipboard(fullKeys.master.seed)} className="text-sm text-gray-400 hover:text-primary">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-xs text-gray-300 break-all">
                    {maskKey(fullKeys.master.seed, revealedKeys['master'])}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Public: {fullKeys.master.publicKey.substring(0, 16)}...</div>
                </div>

                {Object.entries(fullKeys.categories).map(([category, catData]) => (
                  <div key={category} className="border-l-4 border-primary rounded-lg bg-black/30 p-4">
                    <div className="font-semibold text-primary mb-3">📁 {category}</div>

                    <div className="bg-black/40 rounded p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-yellow-400">Category Seed</span>
                        <div className="flex gap-2">
                          <button onClick={() => toggleReveal(`cat-${category}`)} className="text-sm text-gray-400 hover:text-primary">
                            {revealedKeys[`cat-${category}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => copyToClipboard(catData.seed)} className="text-sm text-gray-400 hover:text-primary">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-gray-300 break-all">
                        {maskKey(catData.seed, revealedKeys[`cat-${category}`])}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">Public: {catData.publicKey.substring(0, 16)}...</div>
                    </div>

                    <div className="ml-4 space-y-2">
                      {Object.entries(catData.servers).map(([server, serverData]) => (
                        <div key={server} className="bg-primary/5 rounded p-3">
                          <div className="font-semibold text-blue-400 mb-2">🖥️ {server}</div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400">Public Key:</span>
                                <button onClick={() => copyToClipboard(serverData.publicKey)} className="text-gray-400 hover:text-primary">
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="font-mono text-gray-300 break-all">{serverData.publicKey.substring(0, 32)}...</div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-400">Private Key:</span>
                                <div className="flex gap-2">
                                  <button onClick={() => toggleReveal(serverData.path)} className="text-gray-400 hover:text-primary">
                                    {revealedKeys[serverData.path] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button onClick={() => copyToClipboard(serverData.privateKey)} className="text-gray-400 hover:text-primary">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="font-mono text-gray-300 break-all">
                                {maskKey(serverData.privateKey, revealedKeys[serverData.path])}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Step 2: Key Structure</h2>
          </div>
          <HelpBox>
            Organize your servers into <strong>categories</strong> (e.g., "api", "db", "cache"). Each category gets a unique seed derived from the master. Then add <strong>servers</strong> to each category. Servers in the same category can derive each other's keys (sibling derivation) but cannot access other categories.
          </HelpBox>

          <div className="space-y-3 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Category name"
                className="input flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              />
              <button onClick={addCategory} className="btn-primary whitespace-nowrap">
                <Plus className="w-4 h-4 inline mr-1" /> Add Category
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="select flex-1"
              >
                <option value="">Select category...</option>
                {Object.keys(structure).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                type="text"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                placeholder="Server name"
                className="input flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addServer()}
              />
              <button onClick={addServer} className="btn-primary whitespace-nowrap">
                <Plus className="w-4 h-4 inline mr-1" /> Add Server
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(structure).map(([category, servers]) => (
              <div key={category} className="bg-black/30 rounded-lg p-4 border-l-4 border-primary">
                <div className="font-semibold text-primary mb-2">📁 {category}</div>
                <div className="ml-4 space-y-2">
                  {servers.map(server => (
                    <div key={server} className="flex items-center justify-between bg-primary/10 rounded p-2">
                      <span>🖥️ {server}</span>
                      <button
                        onClick={() => removeServer(category, server)}
                        className="btn-danger text-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileKey className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Access Grants</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={grantPath}
              onChange={(e) => setGrantPath(e.target.value)}
              placeholder="category/server"
              className="input flex-1"
            />
            <select
              value={grantLevel}
              onChange={(e) => setGrantLevel(e.target.value)}
              className="select flex-1"
            >
              {Object.entries(ACCESS_LEVELS).map(([level, info]) => (
                <option key={level} value={level}>{info.name}</option>
              ))}
            </select>
            <button onClick={createGrant} className="btn-primary whitespace-nowrap">
              Create Grant
            </button>
          </div>

          <div className="space-y-2">
            {grants.map((grant, i) => (
              <div key={i} className="bg-black/30 rounded-lg p-3 border-l-4 border-green-400">
                <div className={`font-semibold ${ACCESS_LEVELS[grant.level].color}`}>
                  {grant.path || 'master'} - {ACCESS_LEVELS[grant.level].name}
                </div>
                <pre className="text-xs text-gray-400 mt-2 overflow-x-auto">
                  {JSON.stringify(grant.grant, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Code className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Step 3: Server Bootstrap</h2>
          </div>
          <HelpBox>
            Generate a turnkey deployment script for each server. Select a category and server, optionally set a <strong>discovery secret</strong> (servers with the same secret find each other via P2P), then copy the generated bash script to your server and run it. The server will automatically get its keys, announce itself, and start aliveness monitoring.
          </HelpBox>

          <div className="space-y-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={bootstrapCategory}
                onChange={(e) => setBootstrapCategory(e.target.value)}
                className="select flex-1"
              >
                <option value="">Select category...</option>
                {Object.keys(structure).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={bootstrapServer}
                onChange={(e) => setBootstrapServer(e.target.value)}
                className="select flex-1"
                disabled={!bootstrapCategory}
              >
                <option value="">Select server...</option>
                {bootstrapCategory && structure[bootstrapCategory]?.map(srv => (
                  <option key={srv} value={srv}>{srv}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={discoverySecret}
              onChange={(e) => setDiscoverySecret(e.target.value)}
              placeholder="Discovery secret (optional - auto-generated)"
              className="input w-full"
            />

            <button
              onClick={generateBootstrap}
              className="btn-primary w-full"
              disabled={!bootstrapCategory || !bootstrapServer}
            >
              <Download className="w-4 h-4 inline mr-1" /> Generate Bootstrap Script
            </button>
          </div>

          {showBootstrap && bootstrapScript && (
            <div className="bg-black/40 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-green-400">Bootstrap Script</span>
                <button onClick={() => copyToClipboard(bootstrapScript)} className="text-sm text-gray-400 hover:text-primary">
                  <Copy className="w-4 h-4 inline mr-1" /> Copy
                </button>
              </div>
              <div className="text-xs text-yellow-400 mb-2">
                Discovery Secret: {discoverySecret}
              </div>
              <pre className="font-mono text-xs text-gray-300 overflow-x-auto max-h-96 border border-primary/30 rounded p-3">
                {bootstrapScript}
              </pre>
            </div>
          )}
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Server Aliveness Monitoring</h2>
          </div>
          <HelpBox>
            Monitor the health of your deployed servers via P2P. This checks connectivity, verifies server identity with cryptographic challenges, and reports uptime and latency. Servers must be running and announced on the network to appear here.
          </HelpBox>

          <button onClick={checkServerAliveness} className="btn-primary w-full mb-4">
            Check All Servers
          </button>

          {showAliveness && alivenessResults.length > 0 && (
            <div className="space-y-2">
              {alivenessResults.map((result, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 border-l-4 ${result.success ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>{result.server.name}</span>
                    <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                      {result.success ? '● ONLINE' : '● OFFLINE'}
                    </span>
                  </div>
                  {result.success && result.data?.response && (
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <div>Category: {result.data.response.category}</div>
                      <div>Server: {result.data.response.server}</div>
                      <div>Uptime: {Math.floor(result.data.response.uptime)}s</div>
                      <div>Latency: {result.data.latency}ms</div>
                    </div>
                  )}
                  {!result.success && (
                    <div className="text-xs text-red-400 mt-1">
                      Error: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Hyperdrive Distribution</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={createDrive} className="btn-primary flex-1">Create Drive</button>
            <button onClick={syncDriveToFiles} className="btn-primary flex-1">
              <Download className="w-4 h-4 inline mr-1" /> Sync to Flatfiles
            </button>
          </div>

          {driveKey && (
            <div className="mt-4 bg-black/40 rounded-lg p-4 font-mono text-sm text-primary break-all">
              <div className="text-gray-400 text-xs mb-1">Drive Key:</div>
              {driveKey}
            </div>
          )}
        </section>

        <section className="glass p-6">
          <button
            onClick={() => {
              if (!showAudit) generateAudit()
              setShowAudit(!showAudit)
            }}
            className="flex items-center justify-between w-full text-xl font-semibold"
          >
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <span>Audit Log</span>
            </div>
            {showAudit ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showAudit && (
            <pre className="mt-4 bg-black/40 rounded-lg p-4 text-sm text-primary overflow-x-auto">
              {auditReport}
            </pre>
          )}
        </section>

      </div>
    </div>
  )
}

export default App
