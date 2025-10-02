const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const { createAccessGrant, verifyAccess } = require('@keyringer/access')
const fs = require('fs').promises
const path = require('path')

const createKeyDrive = async (storagePath) => {
  const store = new Corestore(storagePath)
  const drive = new Hyperdrive(store)
  await drive.ready()
  return { store, drive, key: drive.key.toString('hex') }
}

const shareTree = async (drive, tree, grants) => {
  const manifest = {
    tree,
    grants,
    timestamp: Date.now()
  }
  await drive.put('/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  return drive.key.toString('hex')
}

const loadTree = async (drive) => {
  const data = await drive.get('/manifest.json')
  if (!data) throw new Error('No manifest found')
  return JSON.parse(data.toString())
}

const addGrant = async (drive, path, grant) => {
  const manifest = await loadTree(drive)
  if (!manifest.grants) manifest.grants = {}
  manifest.grants[path] = grant
  await drive.put('/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  return manifest
}

const revokeGrant = async (drive, path) => {
  const manifest = await loadTree(drive)
  if (manifest.grants && manifest.grants[path]) {
    delete manifest.grants[path]
    await drive.put('/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  }
  return manifest
}

const connectToDrive = async (storagePath, driveKey) => {
  const store = new Corestore(storagePath)
  const drive = new Hyperdrive(store, Buffer.from(driveKey, 'hex'))
  await drive.ready()
  return { store, drive }
}

const fetchGrantFor = async (drive, targetPath) => {
  const manifest = await loadTree(drive)
  if (!manifest.grants || !manifest.grants[targetPath]) {
    throw new Error(`No grant for path: ${targetPath}`)
  }
  return manifest.grants[targetPath]
}

const syncToFlatfile = async (drive, targetDir) => {
  await fs.mkdir(targetDir, { recursive: true })

  const manifest = await loadTree(drive)

  await fs.writeFile(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  const tree = manifest.tree
  const keysDir = path.join(targetDir, 'keys')
  await fs.mkdir(keysDir, { recursive: true })

  for (const category in tree.branches) {
    const branch = tree.branches[category]
    const categoryDir = path.join(keysDir, category)
    await fs.mkdir(categoryDir, { recursive: true })

    await fs.writeFile(
      path.join(categoryDir, 'public.key'),
      branch.publicKey
    )

    if (branch.leaves) {
      for (const server in branch.leaves) {
        const serverDir = path.join(categoryDir, server)
        await fs.mkdir(serverDir, { recursive: true })

        await fs.writeFile(
          path.join(serverDir, 'public.key'),
          branch.leaves[server].publicKey
        )
      }
    }
  }

  const grantsDir = path.join(targetDir, 'grants')
  await fs.mkdir(grantsDir, { recursive: true })

  if (manifest.grants) {
    for (const grantPath in manifest.grants) {
      const grant = manifest.grants[grantPath]
      const grantFile = grantPath.replace(/\//g, '_') + '.json'
      await fs.writeFile(
        path.join(grantsDir, grantFile),
        JSON.stringify(grant, null, 2)
      )
    }
  }

  return {
    targetDir,
    manifest,
    files: {
      manifest: path.join(targetDir, 'manifest.json'),
      keys: keysDir,
      grants: grantsDir
    }
  }
}

const loadFromFlatfile = async (drive, sourceDir) => {
  const manifestPath = path.join(sourceDir, 'manifest.json')
  const manifestData = await fs.readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestData)

  await drive.put('/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))

  return manifest
}

module.exports = {
  createKeyDrive,
  shareTree,
  loadTree,
  addGrant,
  revokeGrant,
  connectToDrive,
  fetchGrantFor,
  syncToFlatfile,
  loadFromFlatfile
}
